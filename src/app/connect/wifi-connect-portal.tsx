'use client';

/**
 * Public WiFi Captive Portal — Multi-Method Authentication
 *
 * URL: /connect  (or /connect?code=<voucher> for QR scan)
 *
 * Portal resolution flow:
 *   1. User connects to WiFi → gets IP from DHCP → redirected to /connect
 *   2. /connect calls resolve-zone API → server checks client IP against
 *      PortalMapping subnets → returns the correct portal config
 *   3. If no IP match, falls back to default-zone
 *
 * - code: pre-filled voucher code from QR scan (optional)
 *
 * States: loading → auth_form → authenticating → success → error
 */

import { useState, useEffect, Suspense, useCallback } from 'react';
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
  ChevronRight,
  ExternalLink,
  Hotel,
  MapPin,
  PhoneCall,
  Hash,
  WifiOff,
  RefreshCw,
  Gift,
  Info,
  Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface PortalDesign {
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
}

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
  design: PortalDesign;
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

const DEFAULT_DESIGN: PortalDesign = {
  layoutType: 'centered',
  backgroundType: 'gradient',
  gradientFrom: '#0ea5e9',
  gradientTo: '#065f46',
  backgroundColor: '#ffffff',
  textColor: '#1f2937',
  accentColor: '#0d9488',
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
};

// ────────────────────────────────────────────────────────────
// Live Clock Component
// ────────────────────────────────────────────────────────────

function LiveClock({ textColor }: { textColor: string }) {
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

  return (
    <div className="flex items-center justify-center gap-2 text-sm opacity-70">
      <Clock className="w-4 h-4" style={{ color: textColor }} />
      <span style={{ color: textColor }}>{time}</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Voucher Form
// ────────────────────────────────────────────────────────────

function VoucherForm({
  initialCode,
  accentColor,
  textColor,
  onSubmit,
  loading,
  hasQrPrefill,
}: {
  initialCode: string;
  accentColor: string;
  textColor: string;
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
        <div className="flex items-center gap-2 bg-teal-50 rounded-lg p-3">
          <QrCode className="w-4 h-4 text-teal-600 flex-shrink-0" />
          <p className="text-sm text-teal-700">
            <span className="font-medium">QR Code scanned</span> — your
            voucher code has been pre-filled
          </p>
        </div>
      )}

      <div className="space-y-2">
        <label
          className="text-sm font-medium"
          style={{ color: textColor }}
        >
          Voucher Code
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="XXXXX-XXXXX"
          disabled={loading}
          autoFocus={!hasQrPrefill}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          className="w-full px-4 py-3 text-center text-lg font-mono font-bold tracking-wider border-2 border-gray-200 rounded-xl focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase"
          style={{
            borderColor: accentColor + '40',
          }}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 rounded-lg p-3">
          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || !code.trim()}
        className="w-full font-semibold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-[0.98]"
        style={{ backgroundColor: accentColor, color: '#ffffff' }}
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <Wifi className="w-5 h-5" />
            Connect to WiFi
          </>
        )}
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Room Number Form
// ────────────────────────────────────────────────────────────

function RoomNumberForm({
  accentColor,
  textColor,
  onSubmit,
  loading,
}: {
  accentColor: string;
  textColor: string;
  onSubmit: (roomNumber: string, lastName: string) => void;
  loading: boolean;
}) {
  const [room, setRoom] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!room.trim()) {
      setError('Please enter your room number');
      return;
    }
    if (!name.trim()) {
      setError('Please enter your last name');
      return;
    }
    setError('');
    onSubmit(room.trim(), name.trim());
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium" style={{ color: textColor }}>
          Room Number
        </label>
        <div className="relative">
          <DoorOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="e.g. 101"
            disabled={loading}
            autoFocus
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none transition-all disabled:opacity-50"
            style={{ borderColor: accentColor + '40' }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" style={{ color: textColor }}>
          Last Name
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Smith"
            disabled={loading}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none transition-all disabled:opacity-50"
            style={{ borderColor: accentColor + '40' }}
          />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 rounded-lg p-3">
          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || !room.trim() || !name.trim()}
        className="w-full font-semibold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-[0.98]"
        style={{ backgroundColor: accentColor, color: '#ffffff' }}
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Authenticating...
          </>
        ) : (
          <>
            <Key className="w-5 h-5" />
            Sign In with Room
          </>
        )}
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// PMS Credentials Form
// ────────────────────────────────────────────────────────────

function PmsCredentialsForm({
  accentColor,
  textColor,
  onSubmit,
  loading,
}: {
  accentColor: string;
  textColor: string;
  onSubmit: (username: string, password: string) => void;
  loading: boolean;
}) {
  const [uname, setUname] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!uname.trim()) {
      setError('Please enter your username');
      return;
    }
    if (!pass.trim()) {
      setError('Please enter your password');
      return;
    }
    setError('');
    onSubmit(uname.trim(), pass.trim());
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium" style={{ color: textColor }}>
          Username
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={uname}
            onChange={(e) => setUname(e.target.value)}
            placeholder="Enter username"
            disabled={loading}
            autoFocus
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none transition-all disabled:opacity-50"
            style={{ borderColor: accentColor + '40' }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" style={{ color: textColor }}>
          Password
        </label>
        <div className="relative">
          <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Enter password"
            disabled={loading}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none transition-all disabled:opacity-50"
            style={{ borderColor: accentColor + '40' }}
          />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 rounded-lg p-3">
          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || !uname.trim() || !pass.trim()}
        className="w-full font-semibold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-[0.98]"
        style={{ backgroundColor: accentColor, color: '#ffffff' }}
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Authenticating...
          </>
        ) : (
          <>
            <Key className="w-5 h-5" />
            Sign In
          </>
        )}
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// SMS OTP Form (2-step)
// ────────────────────────────────────────────────────────────

function SmsOtpForm({
  accentColor,
  textColor,
  onAuthenticate,
  loading,
}: {
  accentColor: string;
  textColor: string;
  onAuthenticate: (method: string, payload: Record<string, string>) => void;
  loading: boolean;
}) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendOtp = async () => {
    if (!phone.trim()) {
      setError('Please enter your phone number');
      return;
    }
    setError('');
    setOtpSent(false);
    onAuthenticate('sms_otp', { phoneNumber: phone.trim() });
    // Optimistically move to OTP step
    setStep('otp');
    setCountdown(60);
  };

  const handleVerifyOtp = () => {
    if (!otp.trim()) {
      setError('Please enter the OTP code');
      return;
    }
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

  if (step === 'phone') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-500 text-center">
          We&apos;ll send a verification code to your phone
        </p>
        <div className="space-y-2">
          <label className="text-sm font-medium" style={{ color: textColor }}>
            Phone Number
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 123 4567"
              disabled={loading}
              autoFocus
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none transition-all disabled:opacity-50"
              style={{ borderColor: accentColor + '40' }}
            />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 rounded-lg p-3">
            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          onClick={handleSendOtp}
          disabled={loading || !phone.trim()}
          className="w-full font-semibold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-[0.98]"
          style={{ backgroundColor: accentColor, color: '#ffffff' }}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Smartphone className="w-5 h-5" />
              Send Verification Code
            </>
          )}
        </button>
      </div>
    );
  }

  // OTP verification step
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 text-center">
        Enter the 6-digit code sent to{' '}
        <span className="font-medium text-gray-700">{phone}</span>
      </p>

      <div className="space-y-2">
        <label className="text-sm font-medium" style={{ color: textColor }}>
          Verification Code
        </label>
        <input
          type="text"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          disabled={loading}
          autoFocus
          maxLength={6}
          className="w-full px-4 py-3 text-center text-2xl font-mono font-bold tracking-[0.5em] border-2 border-gray-200 rounded-xl focus:outline-none transition-all disabled:opacity-50"
          style={{ borderColor: accentColor + '40' }}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 rounded-lg p-3">
          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={handleVerifyOtp}
        disabled={loading || otp.length < 6}
        className="w-full font-semibold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-[0.98]"
        style={{ backgroundColor: accentColor, color: '#ffffff' }}
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Verifying...
          </>
        ) : (
          <>
            <CheckCircle className="w-5 h-5" />
            Verify & Connect
          </>
        )}
      </button>

      <div className="flex items-center justify-between text-sm">
        <button
          onClick={() => {
            setStep('phone');
            setOtp('');
            setError('');
          }}
          className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <span>&larr;</span> Change number
        </button>
        <button
          onClick={handleResend}
          disabled={countdown > 0}
          className="flex items-center gap-1 disabled:text-gray-300"
          style={{ color: countdown > 0 ? undefined : accentColor }}
        >
          <RefreshCw
            className={`w-3 h-3 ${countdown > 0 ? '' : 'animate-none'}`}
          />
          {countdown > 0
            ? `Resend in ${countdown}s`
            : 'Resend code'}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Open Access Form
// ────────────────────────────────────────────────────────────

function OpenAccessForm({
  accentColor,
  onConnect,
  loading,
}: {
  accentColor: string;
  onConnect: () => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 text-center">
        Click below to connect to the WiFi network
      </p>
      <button
        onClick={onConnect}
        disabled={loading}
        className="w-full font-semibold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-[0.98]"
        style={{ backgroundColor: accentColor, color: '#ffffff' }}
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <Globe className="w-5 h-5" />
            Connect Now
          </>
        )}
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Success Screen
// ────────────────────────────────────────────────────────────

function SuccessScreen({
  authResult,
  accentColor,
  textColor,
  design,
}: {
  authResult: AuthResult;
  accentColor: string;
  textColor: string;
  design: PortalDesign;
}) {
  const [countdown, setCountdown] = useState(10);

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
        style={{ backgroundColor: accentColor + '15' }}
      >
        <CheckCircle className="w-10 h-10" style={{ color: accentColor }} />
      </div>
      <div>
        <h2 className="text-2xl font-bold" style={{ color: textColor }}>
          Connected!
        </h2>
        <p className="text-sm mt-1" style={{ color: textColor + '99' }}>
          {authResult.message || 'You are now connected to hotel WiFi.'}
        </p>
        {design.welcomeMessage && (
          <p className="text-sm mt-2 italic" style={{ color: accentColor }}>
            {design.welcomeMessage}
          </p>
        )}
      </div>

      {/* Session Info Card */}
      <div
        className="rounded-xl p-4 text-sm space-y-3"
        style={{ backgroundColor: accentColor + '08', border: `1px solid ${accentColor}20` }}
      >
        <h3 className="font-semibold text-left" style={{ color: textColor }}>
          Session Details
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: accentColor }} />
            <div className="text-left">
              <p className="text-xs" style={{ color: textColor + '80' }}>
                Duration
              </p>
              <p className="font-medium" style={{ color: textColor }}>
                {authResult.sessionTimeout >= 60
                  ? `${Math.floor(authResult.sessionTimeout / 60)}h ${authResult.sessionTimeout % 60 > 0 ? `${authResult.sessionTimeout % 60}m` : ''}`
                  : `${authResult.sessionTimeout} min`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" style={{ color: accentColor }} />
            <div className="text-left">
              <p className="text-xs" style={{ color: textColor + '80' }}>
                Download
              </p>
              <p className="font-medium" style={{ color: textColor }}>
                {authResult.bandwidthDown} Mbps
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4" style={{ color: accentColor }} />
            <div className="text-left">
              <p className="text-xs" style={{ color: textColor + '80' }}>
                Upload
              </p>
              <p className="font-medium" style={{ color: textColor }}>
                {authResult.bandwidthUp} Mbps
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" style={{ color: accentColor }} />
            <div className="text-left">
              <p className="text-xs" style={{ color: textColor + '80' }}>
                Method
              </p>
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
        style={{ color: accentColor }}
      >
        <RefreshCw className="w-3 h-3" />
        Connect another device
      </button>
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
  const [design, setDesign] = useState<PortalDesign>(DEFAULT_DESIGN);
  const [state, setState] = useState<PortalState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [authResult, setAuthResult] = useState<AuthResult | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('');
  const [guestInfo, setGuestInfo] = useState({ firstName: '', lastName: '', email: '', phone: '' });

  // ── Apply portal config to state ──
  const applyPortalConfig = useCallback((data: PortalConfig) => {
    setPortalConfig(data);
    setDesign({ ...DEFAULT_DESIGN, ...data.design });
    // Initialize selected method from authMethods list
    const methods = data.authMethods?.length
      ? data.authMethods
      : [{ method: data.authMethod || 'voucher', label: data.authMethod || 'voucher', description: '' }];
    setSelectedMethod(methods[0].method);
    setState('auth_form');
  }, []);

  // ── Fetch portal config on mount — IP-based auto-resolution ──
  useEffect(() => {
    let cancelled = false;
    const fetchPortal = async () => {
      try {
        // Step 1: Call resolve-zone API to auto-detect portal from client IP
        // This matches the user's IP against PortalMapping subnets
        const resolveRes = await fetch('/api/wifi/portal/resolve-zone');
        if (cancelled) return;
        const resolveResult = await resolveRes.json();

        if (resolveResult.success && resolveResult.data?.config) {
          // IP matched a subnet → use the mapped portal directly
          console.log(
            '[Portal] IP-resolved zone:',
            resolveResult.data.zone,
            'subnet:',
            resolveResult.data.matchedSubnet
          );
          applyPortalConfig(resolveResult.data.config as PortalConfig);
          return;
        }

        // Step 2: No IP match (or no client IP detectable) → fall back to default-zone
        console.log('[Portal] No IP subnet match, falling back to default-zone');
        const fallbackRes = await fetch(
          '/api/v1/wifi/portal?slug=default-zone'
        );
        if (cancelled) return;
        const fallbackResult = await fallbackRes.json();

        if (fallbackResult.success && fallbackResult.data) {
          applyPortalConfig(fallbackResult.data);
        } else {
          // Even default-zone not found — render with voucher fallback
          console.warn(
            '[Portal] Config not found, using fallback:',
            fallbackResult.error?.message
          );
          setState('auth_form');
        }
      } catch {
        if (cancelled) return;
        console.warn('[Portal] Failed to fetch config, using fallback');
        setState('auth_form');
      }
    };
    fetchPortal();
    return () => {
      cancelled = true;
    };
  }, [applyPortalConfig]);

  // ── Authentication handler ──
  const portalSlug = portalConfig?.slug || 'default-zone';
  const authenticate = useCallback(
    async (method: string, payload: Record<string, string>) => {
      setState('authenticating');
      setErrorMessage('');

      try {
        const body: Record<string, unknown> = {
          method,
          portalSlug,
          ...payload,
        };

        const res = await fetch('/api/v1/wifi/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const result = await res.json();

        // For SMS OTP "send" step, handle optimistically
        if (method === 'sms_otp' && !payload.otpCode && result.success) {
          return; // The SMS form component already handles state transition
        }

        if (result.success && result.data?.authenticated) {
          setAuthResult(result.data);
          setState('success');
        } else {
          setState('error');
          const msg = result.error?.message || 'Authentication failed';
          setErrorMessage(msg);
        }
      } catch {
        setState('error');
        setErrorMessage(
          'Network error. Please ensure you are connected to the hotel WiFi and try again.'
        );
      }
    },
    [portalSlug]
  );

  // ── Style helpers ──
  const accentColor = design.accentColor;
  const textColor = design.textColor;
  const authMethods = portalConfig?.authMethods?.length
    ? portalConfig.authMethods
    : DEFAULT_AUTH_METHODS;
  const activeMethod = selectedMethod || authMethods[0]?.method || 'voucher';
  const formFields = portalConfig?.formFields || null;

  // ── Helper: check if a form field is visible (supports both boolean and object formats) ──
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

  const hasVisibleFormFields = (): boolean => {
    return ['firstName', 'lastName', 'email', 'phone'].some(isFieldVisible);
  };

  // ── Background styles ──
  const bgStyle: React.CSSProperties = {};
  if (design.backgroundType === 'gradient') {
    bgStyle.background = `linear-gradient(135deg, ${design.gradientFrom}, ${design.gradientTo})`;
  } else if (design.backgroundType === 'solid') {
    bgStyle.backgroundColor = design.backgroundColor;
  } else if (design.backgroundType === 'image' && design.backgroundImage) {
    bgStyle.backgroundImage = `url(${design.backgroundImage})`;
    bgStyle.backgroundSize = 'cover';
    bgStyle.backgroundPosition = 'center';
  } else {
    // Default gradient
    bgStyle.background = `linear-gradient(135deg, ${design.gradientFrom}, ${design.gradientTo})`;
  }

  const overlayStyle: React.CSSProperties = {};
  if (design.backgroundType === 'image' || design.backgroundOverlay > 0) {
    overlayStyle.backgroundColor = `rgba(0,0,0,${design.backgroundOverlay / 100})`;
  }

  // ── Loading state ──
  if (state === 'loading') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={bgStyle}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
          <p className="text-white/80 text-sm">Loading portal...</p>
        </div>
      </div>
    );
  }

  // ── Determine which form to show ──
  const isVoucherPrefill = codeParam && activeMethod === 'voucher';
  const canSubmit =
    !portalConfig?.termsRequired || termsAccepted;

  // ── Build guest info payload for auth ──
  const buildGuestInfoPayload = (): Record<string, unknown> | undefined => {
    if (!hasVisibleFormFields()) return undefined;
    const info: Record<string, string> = {};
    if (isFieldVisible('firstName') && guestInfo.firstName.trim()) info.firstName = guestInfo.firstName.trim();
    if (isFieldVisible('lastName') && guestInfo.lastName.trim()) info.lastName = guestInfo.lastName.trim();
    if (isFieldVisible('email') && guestInfo.email.trim()) info.email = guestInfo.email.trim();
    if (isFieldVisible('phone') && guestInfo.phone.trim()) info.phone = guestInfo.phone.trim();
    return Object.keys(info).length > 0 ? info : undefined;
  };

  const renderAuthForm = () => {
    switch (activeMethod) {
      case 'voucher':
        return (
          <VoucherForm
            initialCode={isVoucherPrefill ? codeParam : ''}
            accentColor={accentColor}
            textColor={textColor}
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
            accentColor={accentColor}
            textColor={textColor}
            onSubmit={(room, name) =>
              authenticate('room_number', { roomNumber: room, lastName: name, ...(buildGuestInfoPayload() ? { guestInfo: buildGuestInfoPayload() } : {}) })
            }
            loading={state === 'authenticating'}
          />
        );
      case 'pms_credentials':
        return (
          <PmsCredentialsForm
            accentColor={accentColor}
            textColor={textColor}
            onSubmit={(username, password) =>
              authenticate('pms_credentials', { username, password, ...(buildGuestInfoPayload() ? { guestInfo: buildGuestInfoPayload() } : {}) })
            }
            loading={state === 'authenticating'}
          />
        );
      case 'sms_otp':
        return (
          <SmsOtpForm
            accentColor={accentColor}
            textColor={textColor}
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
            accentColor={accentColor}
            onConnect={() => authenticate('open_access', { ...(buildGuestInfoPayload() ? { guestInfo: buildGuestInfoPayload() } : {}) })}
            loading={state === 'authenticating'}
          />
        );
      default:
        return (
          <VoucherForm
            initialCode={isVoucherPrefill ? codeParam : ''}
            accentColor={accentColor}
            textColor={textColor}
            onSubmit={(code) =>
              authenticate('voucher', { voucherCode: code, ...(buildGuestInfoPayload() ? { guestInfo: buildGuestInfoPayload() } : {}) })
            }
            loading={state === 'authenticating'}
            hasQrPrefill={isVoucherPrefill}
          />
        );
    }
  };

  // ── Method selector tabs (shown when multiple methods are available) ──
  const renderMethodTabs = () => {
    if (authMethods.length <= 1) return null;
    return (
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-1" role="tablist" aria-label="Authentication methods">
        {authMethods.map((am) => (
          <button
            key={am.method}
            role="tab"
            aria-selected={activeMethod === am.method}
            onClick={() => {
              setSelectedMethod(am.method);
              setState('auth_form');
              setErrorMessage('');
              setGuestInfo({ firstName: '', lastName: '', email: '', phone: '' });
            }}
            className={cn(
              'flex-1 text-sm font-medium py-2.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 min-w-0',
              activeMethod === am.method
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            )}
            title={am.description || am.label}
          >
            {METHOD_ICONS[am.method] || <Key className="w-4 h-4" />}
            <span className="truncate">{am.label}</span>
          </button>
        ))}
      </div>
    );
  };

  // ── Guest info fields section (shown when formFields config has visible fields) ──
  const renderGuestInfoFields = () => {
    if (!hasVisibleFormFields()) return null;
    return (
      <div className="space-y-3 mb-4 pb-4 border-b border-gray-100">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Guest Information
        </p>
        {isFieldVisible('firstName') && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1" style={{ color: textColor }}>
              {getFieldLabel('firstName', 'First Name')}
              {isFieldRequired('firstName') && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={guestInfo.firstName}
                onChange={(e) => setGuestInfo((prev) => ({ ...prev, firstName: e.target.value }))}
                placeholder="John"
                disabled={state === 'authenticating'}
                className="w-full pl-10 pr-4 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:outline-none transition-all disabled:opacity-50"
                style={{ borderColor: accentColor + '40' }}
              />
            </div>
          </div>
        )}
        {isFieldVisible('lastName') && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1" style={{ color: textColor }}>
              {getFieldLabel('lastName', 'Last Name')}
              {isFieldRequired('lastName') && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={guestInfo.lastName}
                onChange={(e) => setGuestInfo((prev) => ({ ...prev, lastName: e.target.value }))}
                placeholder="Smith"
                disabled={state === 'authenticating'}
                className="w-full pl-10 pr-4 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:outline-none transition-all disabled:opacity-50"
                style={{ borderColor: accentColor + '40' }}
              />
            </div>
          </div>
        )}
        {isFieldVisible('email') && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1" style={{ color: textColor }}>
              {getFieldLabel('email', 'Email')}
              {isFieldRequired('email') && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={guestInfo.email}
                onChange={(e) => setGuestInfo((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="john@example.com"
                disabled={state === 'authenticating'}
                className="w-full pl-10 pr-4 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:outline-none transition-all disabled:opacity-50"
                style={{ borderColor: accentColor + '40' }}
              />
            </div>
          </div>
        )}
        {isFieldVisible('phone') && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1" style={{ color: textColor }}>
              {getFieldLabel('phone', 'Phone')}
              {isFieldRequired('phone') && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={guestInfo.phone}
                onChange={(e) => setGuestInfo((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="+1 555 123 4567"
                disabled={state === 'authenticating'}
                className="w-full pl-10 pr-4 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:outline-none transition-all disabled:opacity-50"
                style={{ borderColor: accentColor + '40' }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Layout type rendering ──
  const isSplit =
    design.layoutType === 'split_left' ||
    design.layoutType === 'split_right';

  // ── Social media icon helper ──
  const getSocialIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'facebook':
        return 'f';
      case 'instagram':
        return 'IG';
      case 'twitter':
        return 'X';
      case 'linkedin':
        return 'in';
      case 'youtube':
        return '▶';
      case 'tripadvisor':
        return 'TA';
      default:
        return platform.charAt(0).toUpperCase();
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
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
          // ── Split Layout ──
          <div className="w-full max-w-5xl flex flex-col md:flex-row gap-6">
            {/* Info Panel */}
            <div className="flex-1 flex flex-col justify-center text-white p-6 md:p-10 space-y-6">
              {design.logoUrl ? (
                <img
                  src={design.logoUrl}
                  alt="Hotel Logo"
                  className="h-12 object-contain"
                />
              ) : (
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm">
                  <Wifi className="w-7 h-7 text-white" />
                </div>
              )}
              <h1
                className="text-3xl md:text-4xl font-bold"
                style={{ fontFamily: design.headingFontFamily }}
              >
                {design.title}
              </h1>
              <p className="text-white/80 text-lg">{design.subtitle}</p>
              {design.welcomeMessage && (
                <p className="text-white/60 italic">{design.welcomeMessage}</p>
              )}
              {design.showHotelInfo && design.hotelName && (
                <div className="space-y-2 text-sm text-white/70">
                  <p className="flex items-center gap-2">
                    <Hotel className="w-4 h-4" />
                    {design.hotelName}
                  </p>
                  {design.hotelAddress && (
                    <p className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {design.hotelAddress}
                    </p>
                  )}
                  {design.hotelPhone && (
                    <p className="flex items-center gap-2">
                      <PhoneCall className="w-4 h-4" />
                      {design.hotelPhone}
                    </p>
                  )}
                  {design.hotelWebsite && (
                    <p className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      {design.hotelWebsite}
                    </p>
                  )}
                </div>
              )}
              {design.showAmenities && design.amenities.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {design.amenities.map((a, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 text-xs bg-white/15 rounded-full backdrop-blur-sm"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Form Panel */}
            <div className="w-full md:w-[420px]">
              <div
                className="bg-white rounded-2xl shadow-2xl p-6 space-y-5"
                style={{
                  boxShadow:
                    design.cardShadow === 'large'
                      ? '0 25px 50px -12px rgba(0,0,0,0.25)'
                      : design.cardShadow === 'none'
                        ? 'none'
                        : '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
                }}
              >
                {state === 'success' && authResult ? (
                  <SuccessScreen
                    authResult={authResult}
                    accentColor={accentColor}
                    textColor={textColor}
                    design={design}
                  />
                ) : (
                  <>
                    {/* Mobile-only header */}
                    <div className="md:hidden text-center space-y-2">
                      {design.logoUrl ? (
                        <img
                          src={design.logoUrl}
                          alt="Logo"
                          className="h-10 mx-auto object-contain"
                        />
                      ) : (
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mx-auto" style={{ backgroundColor: accentColor + '15' }}>
                          <Wifi className="w-6 h-6" style={{ color: accentColor }} />
                        </div>
                      )}
                      <h2
                        className="text-xl font-bold"
                        style={{
                          color: textColor,
                          fontFamily: design.headingFontFamily,
                        }}
                      >
                        {design.title}
                      </h2>
                      <p className="text-sm text-gray-500">{design.subtitle}</p>
                    </div>

                    {/* Error display */}
                    {state === 'error' && errorMessage && (
                      <div className="flex items-start gap-2 bg-red-50 rounded-lg p-3">
                        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700">{errorMessage}</p>
                      </div>
                    )}

                    {/* Promotion banner */}
                    {design.showPromotion && design.promotionTitle && (
                      <div
                        className="flex items-start gap-3 rounded-lg p-3"
                        style={{ backgroundColor: accentColor + '10' }}
                      >
                        <Gift className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: accentColor }} />
                        <div>
                          <p className="font-semibold text-sm" style={{ color: textColor }}>
                            {design.promotionTitle}
                          </p>
                          {design.promotionDesc && (
                            <p className="text-xs text-gray-500 mt-1">
                              {design.promotionDesc}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Auth Method Tabs */}
                    {renderMethodTabs()}

                    {/* Auth Form */}
                    <div
                      className="transition-opacity duration-200"
                      style={{ opacity: canSubmit ? 1 : 0.5, pointerEvents: canSubmit ? 'auto' : 'none' }}
                    >
                      {renderGuestInfoFields()}
                      {renderAuthForm()}
                    </div>

                    {/* Terms checkbox */}
                    {portalConfig?.termsRequired && (
                      <label className="flex items-start gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                          className="mt-0.5 accent-current"
                          style={{ accentColor }}
                        />
                        <span className="text-gray-600">
                          I agree to the{' '}
                          {portalConfig.design.termsUrl ? (
                            <a
                              href={portalConfig.design.termsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline"
                              style={{ color: accentColor }}
                            >
                              terms and conditions
                            </a>
                          ) : (
                            <span style={{ color: accentColor }} className="font-medium">
                              terms and conditions
                            </span>
                          )}
                        </span>
                      </label>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          // ── Centered / Card / Full-bleed Layout ──
          <div className="w-full max-w-md">
            {/* Clock */}
            {design.showClock && (
              <div className="mb-4 flex justify-center">
                <LiveClock textColor="#ffffff" />
              </div>
            )}

            <div
              className={`bg-white rounded-2xl p-6 space-y-5 ${
                design.layoutType === 'card' ? 'shadow-2xl' : 'shadow-lg'
              }`}
              style={{
                boxShadow:
                  design.cardShadow === 'large'
                    ? '0 25px 50px -12px rgba(0,0,0,0.25)'
                    : design.cardShadow === 'none'
                      ? 'none'
                      : '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
              }}
            >
              {/* Header */}
              <div className="text-center space-y-2">
                {design.logoUrl ? (
                  <img
                    src={design.logoUrl}
                    alt="Hotel Logo"
                    className="h-14 mx-auto object-contain"
                  />
                ) : (
                  <div
                    className="inline-flex items-center justify-center w-14 h-14 rounded-2xl"
                    style={{ backgroundColor: accentColor + '15' }}
                  >
                    <Wifi className="w-7 h-7" style={{ color: accentColor }} />
                  </div>
                )}
                <h1
                  className="text-2xl font-bold"
                  style={{
                    color: textColor,
                    fontFamily: design.headingFontFamily,
                  }}
                >
                  {design.title}
                </h1>
                <p className="text-sm text-gray-500">{design.subtitle}</p>
              </div>

              {/* Hotel info (compact) */}
              {design.showHotelInfo && design.hotelName && (
                <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                  <Hotel className="w-5 h-5 flex-shrink-0" style={{ color: accentColor }} />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: textColor }}>
                      {design.hotelName}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                      {design.hotelAddress && <span>{design.hotelAddress}</span>}
                      {design.hotelPhone && <span>{design.hotelPhone}</span>}
                      {design.hotelWebsite && <span>{design.hotelWebsite}</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Amenity tags */}
              {design.showAmenities && design.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {design.amenities.map((a, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 text-xs rounded-full font-medium"
                      style={{ backgroundColor: accentColor + '12', color: accentColor }}
                    >
                      {a}
                    </span>
                  ))}
                </div>
              )}

              {/* Success state */}
              {state === 'success' && authResult ? (
                <SuccessScreen
                  authResult={authResult}
                  accentColor={accentColor}
                  textColor={textColor}
                  design={design}
                />
              ) : (
                <>
                  {/* Error display */}
                  {state === 'error' && errorMessage && (
                    <div className="flex items-start gap-2 bg-red-50 rounded-lg p-3">
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{errorMessage}</p>
                    </div>
                  )}

                  {/* Promotion banner */}
                  {design.showPromotion && design.promotionTitle && (
                    <div
                      className="flex items-start gap-3 rounded-lg p-3"
                      style={{ backgroundColor: accentColor + '10' }}
                    >
                      <Gift className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: accentColor }} />
                      <div>
                        <p className="font-semibold text-sm" style={{ color: textColor }}>
                          {design.promotionTitle}
                        </p>
                        {design.promotionDesc && (
                          <p className="text-xs text-gray-500 mt-1">
                            {design.promotionDesc}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Auth Method Tabs */}
                  {renderMethodTabs()}

                  {/* Auth Form */}
                  <div
                    className="transition-opacity duration-200"
                    style={{
                      opacity: canSubmit ? 1 : 0.5,
                      pointerEvents: canSubmit ? 'auto' : 'none',
                    }}
                  >
                    {renderGuestInfoFields()}
                    {renderAuthForm()}
                  </div>

                  {/* Terms checkbox */}
                  {portalConfig?.termsRequired && (
                    <label className="flex items-start gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="mt-0.5"
                        style={{ accentColor }}
                      />
                      <span className="text-gray-600">
                        I agree to the{' '}
                        {portalConfig.design.termsUrl ? (
                          <a
                            href={portalConfig.design.termsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                            style={{ color: accentColor }}
                          >
                            terms and conditions
                          </a>
                        ) : (
                          <span style={{ color: accentColor }} className="font-medium">
                            terms and conditions
                          </span>
                        )}
                      </span>
                    </label>
                  )}

                  {/* Info section */}
                  <div className="border-t pt-4 space-y-2">
                    <div className="flex items-start gap-2 text-xs text-gray-400">
                      <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p>Secure connection — your credentials are encrypted</p>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-gray-400">
                      <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p>
                        Session timeout:{' '}
                        {portalConfig?.sessionTimeout || 1440} minutes
                      </p>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-gray-400">
                      <Zap className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p>
                        Bandwidth: up to{' '}
                        {portalConfig?.maxBandwidthDown || 5} Mbps down,{' '}
                        {portalConfig?.maxBandwidthUp || 1} Mbps up
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Social media links */}
            {design.showSocialMedia && design.socialLinks.length > 0 && (
              <div className="flex items-center justify-center gap-3 mt-5">
                {design.socialLinks.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-white/25 transition-colors text-xs font-bold"
                    aria-label={link.platform}
                  >
                    {getSocialIcon(link.platform)}
                  </a>
                ))}
              </div>
            )}

            {/* Footer branding */}
            {design.showBranding && (
              <p className="text-center text-xs text-white/50 mt-6">
                Powered by StaySuite Hospitality OS
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Exported component with Suspense boundary
// ────────────────────────────────────────────────────────────

export function WifiConnectPortal() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
      }
    >
      <PortalContent />
    </Suspense>
  );
}

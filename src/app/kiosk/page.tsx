'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogIn,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  Shield,
  Wifi,
  KeyRound,
  Building2,
  Users,
  Clock,
  MapPin,
  AlertTriangle,
  RefreshCw,
  Hourglass,
  XCircle,
  CreditCard,
  FileText,
  CalendarCheck,
  CalendarX,
  Languages,
  Hotel,
  DoorOpen,
  Receipt,
  ArrowRight,
  Info,
} from 'lucide-react';

/* ────────────────────────────────────────────────
   Types (mirrored from express-kiosk.tsx)
   ──────────────────────────────────────────────── */

type KioskMode = 'select' | 'checkin' | 'checkout';

type CheckInStep = 'enter_code' | 'verify_details' | 'id_terms' | 'success' | 'error';
type CheckOutStep = 'enter_code' | 'verify_folio' | 'confirm_checkout' | 'success' | 'error';

interface KioskBookingData {
  bookingId: string;
  confirmationCode: string;
  guest: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    nationality?: string;
    isVip: boolean;
  };
  room: {
    id: string;
    number: string;
    floor: number;
    housekeepingStatus: string;
  };
  roomType: {
    id: string;
    name: string;
    code: string;
    basePrice: number;
  };
  property: {
    id: string;
    name: string;
    address?: string;
    city?: string;
    checkInTime: string;
    checkOutTime: string;
  };
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  totalAmount: number;
  currency: string;
  specialRequests?: string;
  wifiPlan?: { name: string; validityDays: number } | null;
}

interface CheckInResult {
  roomNumber: string;
  roomFloor: number;
  roomType: string;
  propertyName: string;
  guestName: string;
  checkInTime: string;
  wifiCredentials?: {
    username: string;
    password: string;
    validUntil: string;
  } | null;
}

interface CheckOutResult {
  bookingId: string;
  confirmationCode: string;
  guestName: string;
  roomNumber: string;
  checkOutTime: string;
  propertyName: string;
  folioBalance: number;
  currency: string;
}

/* ────────────────────────────────────────────────
   Constants
   ──────────────────────────────────────────────── */

const DEFAULT_TIMEOUT_SECONDS = 120;
const DEFAULT_HOTEL_NAME = 'StaySuite';
const DEFAULT_TERMS = "By using this kiosk, I agree to the hotel's terms and conditions.";

interface KioskSettings {
  hotelName: string;
  welcomeMessage: string;
  primaryColor: string;
  logoUrl: string | null;
  backgroundStyle: string;
  idleTimeout: number;
  showClock: boolean;
  showLanguageSwitch: boolean;
  enableCheckIn: boolean;
  enableCheckOut: boolean;
  enablePayment: boolean;
  termsContent: string;
  requirePaymentOnCheckout: boolean;
}

const DEFAULT_SETTINGS: KioskSettings = {
  hotelName: DEFAULT_HOTEL_NAME,
  welcomeMessage: 'Welcome! Please select an option below.',
  primaryColor: '#10b981',
  logoUrl: null,
  backgroundStyle: 'gradient',
  idleTimeout: DEFAULT_TIMEOUT_SECONDS,
  showClock: true,
  showLanguageSwitch: true,
  enableCheckIn: true,
  enableCheckOut: true,
  enablePayment: false,
  termsContent: DEFAULT_TERMS,
  requirePaymentOnCheckout: false,
};

const CHECKIN_STEPS = {
  enter_code: { step: 1, title: 'Find Your Booking' },
  verify_details: { step: 2, title: 'Verify Your Details' },
  id_terms: { step: 3, title: 'Confirm & Check In' },
  success: { step: 4, title: 'Welcome!' },
  error: { step: 0, title: 'Something Went Wrong' },
};

const CHECKOUT_STEPS = {
  enter_code: { step: 1, title: 'Find Your Booking' },
  verify_folio: { step: 2, title: 'Review & Settle' },
  confirm_checkout: { step: 3, title: 'Confirm Check-Out' },
  success: { step: 4, title: 'Goodbye!' },
  error: { step: 0, title: 'Something Went Wrong' },
};

/* ────────────────────────────────────────────────
   i18n stubs
   ──────────────────────────────────────────────── */

type Lang = 'en' | 'hi';

const T: Record<Lang, Record<string, string>> = {
  en: {
    welcome: 'Welcome to',
    selectMode: 'How can we help you?',
    checkIn: 'Check In',
    checkInDesc: 'Already have a reservation? Start your express check-in.',
    checkOut: 'Check Out',
    checkOutDesc: 'Time to leave? Complete your check-out quickly.',
    findBooking: 'Find Your Booking',
    enterCode: 'Enter your confirmation code',
    codePlaceholder: 'e.g. STY-AB12CD',
    verifyDetails: 'Verify Your Details',
    confirmCheckIn: 'Confirm & Check In',
    confirmCheckOut: 'Confirm Check-Out',
    welcomeGuest: 'Welcome!',
    goodbyeGuest: 'Goodbye!',
    reviewSettle: 'Review & Settle',
    settleNote: 'Any outstanding balance can be settled at the front desk.',
    startOver: 'Start Over',
    detailsCorrect: 'Details Correct',
    back: 'Back',
    checkInNow: 'Check In Now',
    checkOutNow: 'Check Out Now',
    findBookingBtn: 'Find Booking',
    verifying: 'Verifying...',
    checkingIn: 'Checking In...',
    checkingOut: 'Checking Out...',
    tryAgain: 'Try Again',
    done: 'Done',
    confirmIdentity: 'I confirm my identity',
    identityDesc: 'I verify that I am the guest named on this booking and have a valid ID document with me',
    acceptTerms: 'I accept the terms & conditions',
    termsDesc: 'I agree to the hotel\'s policies including check-in/out times, house rules, payment terms, and liability policies. I understand that any damages to hotel property may incur additional charges.',
    specialRequests: 'Special Requests',
    wifiCredentials: 'WiFi Credentials',
    roomInfo: 'Your Room',
    checkInTime: 'Check-in Time',
    checkOutTime: 'Check-out Time',
    property: 'Property',
    folioBalance: 'Folio Balance',
    balanceNote: 'Visit the front desk to settle any outstanding balance.',
    pleaseProceed: 'Please proceed to your room. Your key card will be provided at the front desk.',
    enjoyStay: 'Enjoy your stay!',
    thankYou: 'Thank you for staying with us!',
    haveSafeJourney: 'Have a safe journey!',
    visitFrontDesk: 'Please visit the front desk for assistance.',
    noBookingFound: 'No confirmed booking found with this code. Please try again.',
    tooEarly: 'Check-in is not yet available for this booking. Please visit the front desk.',
    expired: 'This booking has expired. Please visit the front desk for assistance.',
    noRoom: 'Your room has not been assigned yet. Please visit the front desk.',
    unableVerify: 'Unable to verify your booking. Please try again or visit the front desk.',
    unableCheckIn: 'Unable to complete check-in. Please visit the front desk.',
    unableCheckOut: 'Unable to complete check-out. Please visit the front desk.',
    username: 'Username',
    password: 'Password',
    validUntil: 'Valid until',
    duration: 'Duration',
    guest: 'Guest',
    room: 'Room',
    night: 'night',
    nights: 'nights',
    adult: 'adult',
    adults: 'adults',
    nightLbl: 'night',
    checkInFrom: 'from',
    checkOutBy: 'by',
    codeHint: 'Your confirmation code can be found in your booking confirmation email',
    poweredBy: 'Powered by StaySuite HospitalityOS',
    yourStay: 'Your Stay',
    totalAmount: 'Total Amount',
    nightsStayed: 'Nights Stayed',
    roomType: 'Room Type',
    checkOutDate: 'Check-Out Date',
    confirmCheckoutDesc: 'Please confirm you wish to check out. Return your key card to the front desk.',
    settleAtFrontDesk: 'Settle at front desk',
    allSettled: 'Balance settled',
  },
  hi: {
    welcome: 'में आपका स्वागत है',
    selectMode: 'हम आपकी कैसे मदद कर सकते हैं?',
    checkIn: 'चेक-इन',
    checkInDesc: 'आरक्षण पहले से है? अपना एक्सप्रेस चेक-इन शुरू करें।',
    checkOut: 'चेक-आउट',
    checkOutDesc: 'जाने का समय? जल्दी से चेक-आउट पूरा करें।',
    findBooking: 'अपना बुकिंग खोजें',
    enterCode: 'अपना कन्फर्मेशन कोड दर्ज करें',
    codePlaceholder: 'उदा. STY-AB12CD',
    verifyDetails: 'अपना विवरण सत्यापित करें',
    confirmCheckIn: 'पुष्टि करें और चेक-इन करें',
    confirmCheckOut: 'चेक-आउट की पुष्टि करें',
    welcomeGuest: 'स्वागत है!',
    goodbyeGuest: 'अलविदा!',
    reviewSettle: 'समीक्षा करें और भुगतान करें',
    settleNote: 'कोई भी बकाया राशि फ्रंट डेस्क पर भुगतान की जा सकती है।',
    startOver: 'फिर से शुरू करें',
    detailsCorrect: 'विवरण सही है',
    back: 'वापस',
    checkInNow: 'अभी चेक-इन करें',
    checkOutNow: 'अभी चेक-आउट करें',
    findBookingBtn: 'बुकिंग खोजें',
    verifying: 'सत्यापित हो रहा है...',
    checkingIn: 'चेक-इन हो रहा है...',
    checkingOut: 'चेक-आउट हो रहा है...',
    tryAgain: 'फिर से प्रयास करें',
    done: 'हो गया',
    confirmIdentity: 'मैं अपनी पहचान पुष्टि करता/करती हूँ',
    identityDesc: 'मैं सत्यापित करता/करती हूँ कि मैं इस बुकिंग पर नामित अतिथि हूँ और मेरे पास वैध पहचान पत्र है',
    acceptTerms: 'मैं नियम और शर्तें स्वीकार करता/करती हूँ',
    termsDesc: 'मैं होटल की नीतियों से सहमत हूँ जिसमें चेक-इन/आउट समय, घर के नियम, भुगतान शर्तें, और देयता नीतियां शामिल हैं।',
    specialRequests: 'विशेष अनुरोध',
    wifiCredentials: 'WiFi क्रेडेंशियल',
    roomInfo: 'आपका कमरा',
    checkInTime: 'चेक-इन समय',
    checkOutTime: 'चेक-आउट समय',
    property: 'संपत्ति',
    folioBalance: 'बिल शेष',
    balanceNote: 'बकाया राशि के लिए फ्रंट डेस्क पर जाएं।',
    pleaseProceed: 'कृपया अपने कमरे में जाएं। आपकी कुंजी कार्ड फ्रंट डेस्क पर मिलेगी।',
    enjoyStay: 'आपके प्रवास का आनंद लें!',
    thankYou: 'हमारे साथ रहने के लिए धन्यवाद!',
    haveSafeJourney: 'सुरक्षित यात्रा हो!',
    visitFrontDesk: 'कृपया सहायता के लिए फ्रंट डेस्क पर जाएं।',
    noBookingFound: 'इस कोड से कोई पुष्टि बुकिंग नहीं मिली। कृपया पुनः प्रयास करें।',
    tooEarly: 'इस बुकिंग के लिए चेक-इन अभी उपलब्ध नहीं है।',
    expired: 'यह बुकिंग समाप्त हो चुकी है।',
    noRoom: 'आपका कमरा अभी तक आवंटित नहीं है।',
    unableVerify: 'बुकिंग सत्यापित करने में असमर्थ।',
    unableCheckIn: 'चेक-इन पूरा करने में असमर्थ।',
    unableCheckOut: 'चेक-आउट पूरा करने में असमर्थ।',
    username: 'उपयोगकर्ता नाम',
    password: 'पासवर्ड',
    validUntil: 'तक वैध',
    duration: 'अवधि',
    guest: 'अतिथि',
    room: 'कमरा',
    night: 'रात',
    nights: 'रातें',
    adult: 'वयस्क',
    adults: 'वयस्क',
    nightLbl: 'रात',
    checkInFrom: 'से',
    checkOutBy: 'तक',
    codeHint: 'आपका कन्फर्मेशन कोड बुकिंग कन्फर्मेशन ईमेल में मिल सकता है',
    poweredBy: 'Powered by StaySuite HospitalityOS',
    yourStay: 'आपका प्रवास',
    totalAmount: 'कुल राशि',
    nightsStayed: 'रातें बिताई',
    roomType: 'कमरा प्रकार',
    checkOutDate: 'चेक-आउट तिथि',
    confirmCheckoutDesc: 'कृपया पुष्टि करें कि आप चेक-आउट करना चाहते हैं। अपनी कुंजी कार्ड फ्रंट डेस्क पर लौटाएं।',
    settleAtFrontDesk: 'फ्रंट डेस्क पर भुगतान करें',
    allSettled: 'शेष भुगतान',
  },
};

/* ────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────── */

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/* ────────────────────────────────────────────────
   Framer-motion variants
   ──────────────────────────────────────────────── */

const slideIn = {
  initial: { opacity: 0, x: 60 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -60 },
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

/* ────────────────────────────────────────────────
   Main Component
   ──────────────────────────────────────────────── */

export default function KioskPage() {
  /* ── State ── */
  const [mode, setMode] = useState<KioskMode>('select');
  const [lang, setLang] = useState<Lang>('en');

  // Check-in state
  const [ciStep, setCiStep] = useState<CheckInStep>('enter_code');
  const [ciCode, setCiCode] = useState('');
  const [ciBooking, setCiBooking] = useState<KioskBookingData | null>(null);
  const [ciResult, setCiResult] = useState<CheckInResult | null>(null);
  const [ciVerifying, setCiVerifying] = useState(false);
  const [ciChecking, setCiChecking] = useState(false);
  const [ciIdOk, setCiIdOk] = useState(false);
  const [ciTermsOk, setCiTermsOk] = useState(false);

  // Check-out state
  const [coStep, setCoStep] = useState<CheckOutStep>('enter_code');
  const [coCode, setCoCode] = useState('');
  const [coBooking, setCoBooking] = useState<KioskBookingData | null>(null);
  const [coResult, setCoResult] = useState<CheckOutResult | null>(null);
  const [coVerifying, setCoVerifying] = useState(false);
  const [coChecking, setCoChecking] = useState(false);

  // Kiosk settings
  const [settings, setSettings] = useState<KioskSettings>(DEFAULT_SETTINGS);

  const [errorMsg, setErrorMsg] = useState('');
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIMEOUT_SECONDS);
  const [now, setNow] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const t = T[lang];
  const TIMEOUT_SECONDS = settings.idleTimeout || DEFAULT_TIMEOUT_SECONDS;
  const HOTEL_NAME = settings.hotelName || DEFAULT_HOTEL_NAME;

  /* ── Fetch kiosk settings on mount ── */
  useEffect(() => {
    fetch('/api/kiosk/public-settings')
      .then(res => res.ok ? res.json() : null)
      .then(result => {
        if (result?.success?.data) {
          setSettings(prev => ({ ...prev, ...result.data }));
        }
      })
      .catch(() => { /* Use defaults on error */ });
  }, []);

  /* ── Clock — initialize on client only to avoid hydration mismatch ── */
  useEffect(() => {
    setMounted(true);
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  /* ── Reset state helper ── */
  const clearAllTimers = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const resetAllState = () => {
    setMode('select');
    setCiStep('enter_code');
    setCiCode('');
    setCiBooking(null);
    setCiResult(null);
    setCiVerifying(false);
    setCiChecking(false);
    setCiIdOk(false);
    setCiTermsOk(false);
    setCoStep('enter_code');
    setCoCode('');
    setCoBooking(null);
    setCoResult(null);
    setCoVerifying(false);
    setCoChecking(false);
    setErrorMsg('');
    setTimeLeft(TIMEOUT_SECONDS);
  };

  /* ── Ref-based timeout to avoid circular deps ── */
  const onTimeoutRef = useRef<() => void>(() => {});

  const startTimeout = useCallback(() => {
    clearAllTimers();
    setTimeLeft(TIMEOUT_SECONDS);

    countdownRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          onTimeoutRef.current();
          return TIMEOUT_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    // Interval-based timeout — prevents double-fire from setTimeout drift
    // No separate setTimeout needed since the interval handles the reset at prev <= 1
  }, []);

  const handleFullReset = useCallback(() => {
    clearAllTimers();
    resetAllState();
    // Defer startTimeout to avoid calling setState synchronously in effect/callback
    setTimeout(() => startTimeout(), 0);
  }, [startTimeout]);

  const resetToModeSelect = useCallback(() => {
    clearAllTimers();
    resetAllState();
    setTimeout(() => startTimeout(), 0);
  }, [startTimeout]);

  // Keep the ref up to date so interval callback always calls latest fn
  useEffect(() => {
    onTimeoutRef.current = handleFullReset;
  }, [handleFullReset]);

  /* ── Kick off timeout on mount ── */
  useEffect(() => {
    const id = setTimeout(() => startTimeout(), 0);
    return () => {
      clearTimeout(id);
      clearAllTimers();
    };
  }, [startTimeout]);

  /* ──────────────────────────────────────────────
     Check-In API calls
     ────────────────────────────────────────────── */

  const verifyCheckInCode = async () => {
    if (!ciCode.trim()) return;
    setCiVerifying(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/frontdesk/kiosk-session?code=${encodeURIComponent(ciCode.trim())}`);
      if (!res.ok) { const txt = await res.text().catch(() => ''); throw new Error(txt); }
      const result = await res.json();

      if (result.success) {
        setCiBooking(result.data);
        setCiStep('verify_details');
        startTimeout();
      } else {
        const code = result.error?.code;
        if (code === 'TOO_EARLY') setErrorMsg(t.tooEarly);
        else if (code === 'EXPIRED') setErrorMsg(t.expired);
        else if (code === 'NO_ROOM') setErrorMsg(t.noRoom);
        else setErrorMsg(t.noBookingFound);
      }
    } catch {
      setErrorMsg(t.unableVerify);
    } finally {
      setCiVerifying(false);
    }
  };

  const processCheckIn = async () => {
    if (!ciBooking || !ciIdOk || !ciTermsOk) return;
    setCiChecking(true);
    try {
      const res = await fetch('/api/frontdesk/kiosk-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: ciBooking.bookingId,
          idVerified: true,
          termsAccepted: true,
        }),
      });
      if (!res.ok) { const txt = await res.text().catch(() => ''); throw new Error(txt); }
      const result = await res.json();

      if (result.success) {
        setCiResult(result.data);
        setCiStep('success');
      } else {
        setErrorMsg(result.error?.message || t.unableCheckIn);
        setCiStep('error');
      }
    } catch {
      setErrorMsg(t.unableCheckIn);
      setCiStep('error');
    } finally {
      setCiChecking(false);
    }
  };

  /* ──────────────────────────────────────────────
     Check-Out API calls
     ────────────────────────────────────────────── */

  const verifyCheckOutCode = async () => {
    if (!coCode.trim()) return;
    setCoVerifying(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/frontdesk/kiosk-session?code=${encodeURIComponent(coCode.trim())}&purpose=checkout`);
      if (!res.ok) { const txt = await res.text().catch(() => ''); throw new Error(txt); }
      const result = await res.json();

      if (result.success) {
        // For check-out, we also accept checked_in bookings
        setCoBooking(result.data);
        setCoStep('verify_folio');
        startTimeout();
      } else {
        // Try specifically for checked_in bookings
        const code = result.error?.code;
        if (code === 'TOO_EARLY') setErrorMsg(t.tooEarly);
        else if (code === 'EXPIRED') setErrorMsg(t.expired);
        else if (code === 'NO_ROOM') setErrorMsg(t.noRoom);
        else setErrorMsg(t.noBookingFound);
      }
    } catch {
      setErrorMsg(t.unableVerify);
    } finally {
      setCoVerifying(false);
    }
  };

  const processCheckOut = async () => {
    if (!coBooking) return;
    setCoChecking(true);
    try {
      const res = await fetch('/api/frontdesk/kiosk-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: coBooking.bookingId,
        }),
      });
      if (!res.ok) { const txt = await res.text().catch(() => ''); throw new Error(txt); }
      const result = await res.json();

      if (result.success) {
        setCoResult(result.data);
        setCoStep('success');
      } else {
        setErrorMsg(result.error?.message || t.unableCheckOut);
        setCoStep('error');
      }
    } catch {
      setErrorMsg(t.unableCheckOut);
      setCoStep('error');
    } finally {
      setCoChecking(false);
    }
  };

  /* ── Progress helpers ── */
  const ciProgress = ciStep === 'error' ? 0 : ciStep === 'success' ? 100 : (CHECKIN_STEPS[ciStep].step / 4) * 100;
  const coProgress = coStep === 'error' ? 0 : coStep === 'success' ? 100 : (CHECKOUT_STEPS[coStep].step / 4) * 100;
  const showProgress = mode !== 'select';
  const currentProgress = mode === 'checkin' ? ciProgress : coProgress;

  /* ──────────────────────────────────────────────
     Render
     ────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col text-white relative overflow-hidden">
      {/* ── Ambient glow decorations ── */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* ── Progress bar ── */}
      {showProgress && (
        <div className="w-full h-1.5 bg-slate-700/60 relative z-20">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-r-full"
            initial={{ width: 0 }}
            animate={{ width: `${currentProgress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      )}

      {/* ═══════════════════════════════════════════
          HEADER
          ═══════════════════════════════════════════ */}
      <header className="relative z-10 flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
        {/* Hotel branding */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Hotel className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base lg:text-lg font-semibold leading-tight">
              {t.welcome} {HOTEL_NAME}
            </h1>
            {now && (
            <p className="text-xs text-slate-400 hidden sm:block">
              {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            )}
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3 sm:gap-5">
          {/* Clock — only if enabled in settings */}
          {settings.showClock && now && (
          <div className="text-right hidden sm:block">
            <p className="text-lg lg:text-xl font-mono font-semibold tabular-nums">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-xs text-slate-400 font-mono tabular-nums">
              {now.toLocaleTimeString([], { second: '2-digit' })}
            </p>
          </div>
          )

          {/* Language switch — only if enabled in settings */}
          {settings.showLanguageSwitch && (
          <button
            onClick={() => setLang(l => l === 'en' ? 'hi' : 'en')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-sm transition-colors"
          >
            <Languages className="w-4 h-4" />
            <span className="hidden sm:inline">{lang === 'en' ? 'हिन्दी' : 'English'}</span>
            <span className="sm:hidden text-xs">{lang === 'en' ? 'HI' : 'EN'}</span>
          </button>
          )}

          {/* Timeout indicator */}
          {mode !== 'select' && (
            <div className="flex items-center gap-1.5 text-sm">
              <Hourglass className={`w-4 h-4 ${timeLeft < 30 ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
              <span className="font-mono text-xs text-slate-400">{formatTime(timeLeft)}</span>
            </div>
          )}

          {/* Start over button */}
          {mode !== 'select' && (
            <button
              onClick={resetToModeSelect}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">{t.startOver}</span>
            </button>
          )}
        </div>
      </header>

      {/* ═══════════════════════════════════════════
          STEP INDICATOR (for check-in / check-out flows)
          ═══════════════════════════════════════════ */}
      {mode !== 'select' && (
        <div className="flex items-center justify-center gap-2 pb-4 relative z-10">
          {[1, 2, 3, 4].map(s => {
            const currentStepConfig = mode === 'checkin' ? CHECKIN_STEPS[ciStep] : CHECKOUT_STEPS[coStep];
            const isActive = s === currentStepConfig.step;
            const isComplete = s < currentStepConfig.step;
            const isError = (mode === 'checkin' ? ciStep : coStep) === 'error';

            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                    isError
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : isComplete
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                        : isActive
                          ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500'
                          : 'bg-slate-700/50 text-slate-500 border border-slate-600/50'
                  }`}
                >
                  {isComplete ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> : s}
                </div>
                {s < 4 && (
                  <div
                    className={`w-8 sm:w-12 h-0.5 rounded-full transition-colors duration-300 ${
                      isComplete ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          MAIN CONTENT
          ═══════════════════════════════════════════ */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 pb-6 relative z-10">
        <AnimatePresence mode="wait">

          {/* ───────────────────────────────────────
              MODE SELECTOR
              ─────────────────────────────────────── */}
          {mode === 'select' && (
            <motion.div
              key="mode-select"
              {...scaleIn}
              transition={{ duration: 0.4 }}
              className="w-full max-w-3xl"
            >
              <div className="text-center space-y-3 mb-8 sm:mb-10">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                  className="inline-flex w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 items-center justify-center mb-2"
                >
                  <Hotel className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400" />
                </motion.div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">{t.selectMode}</h2>
                <p className="text-slate-400 text-sm sm:text-base">Self-service kiosk — tap to begin</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {/* Check-In Card — only if enabled in settings */}
                {settings.enableCheckIn && (
                <motion.button
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setMode('checkin');
                    setCiStep('enter_code');
                    startTimeout();
                  }}
                  className="group relative p-6 sm:p-8 lg:p-10 rounded-2xl bg-slate-800/60 border border-slate-700/50 hover:border-emerald-500/50 hover:bg-slate-800/80 backdrop-blur-sm text-left transition-all duration-300 overflow-hidden"
                >
                  {/* Glow on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-cyan-500/0 group-hover:from-emerald-500/5 group-hover:to-cyan-500/5 transition-all duration-500" />
                  <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/0 group-hover:bg-emerald-500/10 rounded-full blur-3xl transition-all duration-500" />

                  <div className="relative z-10 space-y-4">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 flex items-center justify-center transition-colors duration-300">
                      <LogIn className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold">{t.checkIn}</h3>
                      <p className="text-slate-400 text-sm mt-1">{t.checkInDesc}</p>
                    </div>
                    <div className="flex items-center text-emerald-400 font-medium text-sm">
                      <span>{t.checkIn}</span>
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </motion.button>
                )}

                {/* Check-Out Card — only if enabled in settings */}
                {settings.enableCheckOut && (
                <motion.button
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setMode('checkout');
                    setCoStep('enter_code');
                    startTimeout();
                  }}
                  className="group relative p-6 sm:p-8 lg:p-10 rounded-2xl bg-slate-800/60 border border-slate-700/50 hover:border-amber-500/50 hover:bg-slate-800/80 backdrop-blur-sm text-left transition-all duration-300 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 to-orange-500/0 group-hover:from-amber-500/5 group-hover:to-orange-500/5 transition-all duration-500" />
                  <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-500/0 group-hover:bg-amber-500/10 rounded-full blur-3xl transition-all duration-500" />

                  <div className="relative z-10 space-y-4">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-amber-500/10 group-hover:bg-amber-500/20 flex items-center justify-center transition-colors duration-300">
                      <LogOut className="w-7 h-7 sm:w-8 sm:h-8 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold">{t.checkOut}</h3>
                      <p className="text-slate-400 text-sm mt-1">{t.checkOutDesc}</p>
                    </div>
                    <div className="flex items-center text-amber-400 font-medium text-sm">
                      <span>{t.checkOut}</span>
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </motion.button>
                )}

                {/* Neither check-in nor check-out enabled message */}
                {!settings.enableCheckIn && !settings.enableCheckOut && (
                  <div className="col-span-full text-center py-12 text-slate-400">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-400" />
                    <p className="text-lg">Kiosk is currently unavailable</p>
                    <p className="text-sm mt-1">Please visit the front desk for assistance.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ───────────────────────────────────────
              CHECK-IN FLOW
              ─────────────────────────────────────── */}
          {mode === 'checkin' && (
            <div className="w-full max-w-lg">
              <AnimatePresence mode="wait">

                {/* CI Step 1: Enter Code */}
                {ciStep === 'enter_code' && (
                  <motion.div key="ci-enter" {...slideIn} transition={{ duration: 0.3 }}>
                    <div className="rounded-2xl bg-slate-800/70 border border-slate-700/50 backdrop-blur-sm p-6 sm:p-8">
                      <div className="text-center space-y-5">
                        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                          <KeyRound className="w-8 h-8 text-emerald-400" />
                        </div>
                        <div>
                          <h2 className="text-2xl sm:text-3xl font-bold">{t.findBooking}</h2>
                          <p className="text-slate-400 mt-1">{t.enterCode}</p>
                        </div>

                        <div className="space-y-4">
                          <input
                            value={ciCode}
                            onChange={e => setCiCode(e.target.value.toUpperCase())}
                            onKeyDown={e => e.key === 'Enter' && verifyCheckInCode()}
                            placeholder={t.codePlaceholder}
                            className="w-full h-16 sm:h-18 text-2xl text-center font-mono tracking-widest rounded-xl bg-slate-900/60 border border-slate-600/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                            autoFocus
                          />

                          {errorMsg && (
                            <motion.div
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"
                            >
                              <XCircle className="w-4 h-4 shrink-0" />
                              <p>{errorMsg}</p>
                            </motion.div>
                          )}

                          <button
                            onClick={verifyCheckInCode}
                            disabled={!ciCode.trim() || ciVerifying}
                            className="w-full h-14 sm:h-16 text-lg font-semibold rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {ciVerifying ? (
                              <><Loader2 className="w-5 h-5 animate-spin" /> {t.verifying}</>
                            ) : (
                              <>{t.findBookingBtn} <ChevronRight className="w-5 h-5" /></>
                            )}
                          </button>
                        </div>

                        <p className="text-xs text-slate-500">{t.codeHint}</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* CI Step 2: Verify Details */}
                {ciStep === 'verify_details' && ciBooking && (
                  <motion.div key="ci-verify" {...slideIn} transition={{ duration: 0.3 }}>
                    <div className="rounded-2xl bg-slate-800/70 border border-slate-700/50 backdrop-blur-sm p-6 sm:p-8">
                      <div className="space-y-6">
                        <div className="text-center">
                          <h2 className="text-2xl sm:text-3xl font-bold">{t.verifyDetails}</h2>
                          <p className="text-slate-400 mt-1 text-sm">Please confirm the information below is correct</p>
                        </div>

                        {/* Guest info card */}
                        <div className="p-4 sm:p-5 bg-slate-900/50 rounded-xl border border-slate-700/30 space-y-3">
                          <h3 className="font-semibold text-lg sm:text-xl">
                            {ciBooking.guest.firstName} {ciBooking.guest.lastName}
                          </h3>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="flex items-center gap-2 text-slate-300">
                              <Building2 className="w-4 h-4 text-slate-500" />
                              <span>{ciBooking.roomType.name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                              <KeyRound className="w-4 h-4 text-slate-500" />
                              <span>{t.room} {ciBooking.room.number}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                              <Clock className="w-4 h-4 text-slate-500" />
                              <span>{ciBooking.nights} {ciBooking.nights === 1 ? t.night : t.nights}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                              <Users className="w-4 h-4 text-slate-500" />
                              <span>{ciBooking.adults} {ciBooking.adults === 1 ? t.adult : t.adults}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-300 col-span-2">
                              <MapPin className="w-4 h-4 text-slate-500" />
                              <span className="text-xs">{ciBooking.property.name}</span>
                            </div>
                          </div>
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 sm:p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-xl text-center">
                            <p className="text-xs text-emerald-400 uppercase tracking-wider">{t.checkIn}</p>
                            <p className="font-semibold mt-1">
                              {new Date(ciBooking.checkIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                            <p className="text-xs text-slate-400">{t.checkInFrom} {ciBooking.property.checkInTime}</p>
                          </div>
                          <div className="p-3 sm:p-4 bg-amber-500/5 border border-amber-500/15 rounded-xl text-center">
                            <p className="text-xs text-amber-400 uppercase tracking-wider">{t.checkOut}</p>
                            <p className="font-semibold mt-1">
                              {new Date(ciBooking.checkOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                            <p className="text-xs text-slate-400">{t.checkOutBy} {ciBooking.property.checkOutTime}</p>
                          </div>
                        </div>

                        {/* Confirmation code */}
                        <div className="text-center">
                          <span className="inline-block px-4 py-1.5 rounded-lg bg-slate-700/50 border border-slate-600/50 font-mono text-sm tracking-wider">
                            {ciBooking.confirmationCode}
                          </span>
                        </div>

                        {/* Special requests */}
                        {ciBooking.specialRequests && (
                          <div className="p-3 bg-amber-500/5 border border-amber-500/15 rounded-xl">
                            <p className="text-xs text-amber-400 font-medium">{t.specialRequests}</p>
                            <p className="text-sm mt-1 text-slate-300">{ciBooking.specialRequests}</p>
                          </div>
                        )}

                        <div className="flex gap-3">
                          <button
                            onClick={() => { setCiStep('enter_code'); setErrorMsg(''); startTimeout(); }}
                            className="flex-1 h-14 text-base rounded-xl bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 transition-colors flex items-center justify-center gap-2"
                          >
                            <ChevronLeft className="w-5 h-5" /> {t.back}
                          </button>
                          <button
                            onClick={() => { setCiStep('id_terms'); startTimeout(); }}
                            className="flex-1 h-14 text-base font-semibold rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                          >
                            {t.detailsCorrect} <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>

                        <p className="text-xs text-center text-slate-500">
                          If any details are incorrect, please visit the front desk
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* CI Step 3: ID Verification & Terms */}
                {ciStep === 'id_terms' && ciBooking && (
                  <motion.div key="ci-idterms" {...slideIn} transition={{ duration: 0.3 }}>
                    <div className="rounded-2xl bg-slate-800/70 border border-slate-700/50 backdrop-blur-sm p-6 sm:p-8">
                      <div className="space-y-6">
                        <div className="text-center">
                          <h2 className="text-2xl sm:text-3xl font-bold">{t.confirmCheckIn}</h2>
                          <p className="text-slate-400 mt-1 text-sm">Complete the final steps to check in</p>
                        </div>

                        {/* ID checkbox */}
                        <label
                          className={`block p-4 sm:p-5 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                            ciIdOk
                              ? 'border-emerald-500/50 bg-emerald-500/5'
                              : 'border-slate-600/50 hover:border-slate-500/50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="relative mt-0.5">
                              <input
                                type="checkbox"
                                checked={ciIdOk}
                                onChange={e => { setCiIdOk(e.target.checked); startTimeout(); }}
                                className="sr-only peer"
                              />
                              <div className="w-5 h-5 rounded border-2 border-slate-500 peer-checked:border-emerald-500 peer-checked:bg-emerald-500 transition-all flex items-center justify-center">
                                {ciIdOk && <CheckCircle2 className="w-5 h-5 text-white" />}
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 font-medium">
                                <Shield className="w-5 h-5 text-emerald-400" />
                                <span>{t.confirmIdentity}</span>
                              </div>
                              <p className="text-sm text-slate-400 mt-1">{t.identityDesc}</p>
                            </div>
                          </div>
                        </label>

                        {/* Terms checkbox */}
                        <label
                          className={`block p-4 sm:p-5 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                            ciTermsOk
                              ? 'border-emerald-500/50 bg-emerald-500/5'
                              : 'border-slate-600/50 hover:border-slate-500/50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="relative mt-0.5">
                              <input
                                type="checkbox"
                                checked={ciTermsOk}
                                onChange={e => { setCiTermsOk(e.target.checked); startTimeout(); }}
                                className="sr-only peer"
                              />
                              <div className="w-5 h-5 rounded border-2 border-slate-500 peer-checked:border-emerald-500 peer-checked:bg-emerald-500 transition-all flex items-center justify-center">
                                {ciTermsOk && <CheckCircle2 className="w-5 h-5 text-white" />}
                              </div>
                            </div>
                            <div>
                              <div className="font-medium">{t.acceptTerms}</div>
                              <p className="text-sm text-slate-400 mt-1">{settings.termsContent || t.termsDesc}</p>
                            </div>
                          </div>
                        </label>

                        {/* Summary */}
                        <div className="p-3 sm:p-4 bg-slate-900/50 rounded-xl border border-slate-700/30 text-sm space-y-2">
                          <div className="flex justify-between">
                            <span className="text-slate-400">{t.guest}</span>
                            <span className="font-medium">{ciBooking.guest.firstName} {ciBooking.guest.lastName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">{t.room}</span>
                            <span className="font-medium">{ciBooking.room.number} ({ciBooking.roomType.name})</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">{t.duration}</span>
                            <span className="font-medium">{ciBooking.nights} {ciBooking.nights === 1 ? t.night : t.nights}</span>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={() => { setCiStep('verify_details'); startTimeout(); }}
                            className="flex-1 h-14 text-base rounded-xl bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 transition-colors flex items-center justify-center gap-2"
                          >
                            <ChevronLeft className="w-5 h-5" /> {t.back}
                          </button>
                          <button
                            onClick={processCheckIn}
                            disabled={!ciIdOk || !ciTermsOk || ciChecking}
                            className="flex-1 h-14 text-base font-semibold rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                          >
                            {ciChecking ? (
                              <><Loader2 className="w-5 h-5 animate-spin" /> {t.checkingIn}</>
                            ) : (
                              <>{t.checkInNow} <CheckCircle2 className="w-5 h-5" /></>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* CI Step 4: Success */}
                {ciStep === 'success' && ciResult && (
                  <motion.div key="ci-success" {...scaleIn} transition={{ duration: 0.4 }}>
                    <div className="rounded-2xl bg-slate-800/70 border border-emerald-500/20 backdrop-blur-sm p-6 sm:p-8">
                      <div className="text-center space-y-6">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                          className="mx-auto w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center border border-emerald-500/30"
                        >
                          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                        </motion.div>

                        <div>
                          <h2 className="text-3xl font-bold text-emerald-400">{t.welcomeGuest}</h2>
                          <p className="text-slate-300 mt-1 text-lg">{ciResult.guestName}</p>
                        </div>

                        {/* Room info */}
                        <div className="p-5 sm:p-6 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 rounded-xl border border-emerald-500/15 space-y-4">
                          <div>
                            <p className="text-xs text-emerald-400 uppercase tracking-wider font-medium">{t.roomInfo}</p>
                            <p className="text-5xl font-bold text-emerald-400 mt-1">{ciResult.roomNumber}</p>
                            <p className="text-sm text-slate-400 mt-1">{ciResult.roomType} · {t.checkInTime} {ciResult.roomFloor}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-slate-500">{t.checkInTime}</p>
                              <p className="font-medium">
                                {new Date(ciResult.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">{t.property}</p>
                              <p className="font-medium">{ciResult.propertyName}</p>
                            </div>
                          </div>
                        </div>

                        {/* WiFi */}
                        {ciResult.wifiCredentials && (
                          <div className="p-4 sm:p-5 bg-cyan-500/5 border border-cyan-500/15 rounded-xl text-left space-y-3">
                            <div className="flex items-center gap-2">
                              <Wifi className="w-5 h-5 text-cyan-400" />
                              <h3 className="font-semibold text-cyan-400">{t.wifiCredentials}</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-xs text-slate-500">{t.username}</p>
                                <p className="font-mono font-medium text-sm">{ciResult.wifiCredentials.username}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">{t.password}</p>
                                <p className="font-mono font-medium text-sm">{ciResult.wifiCredentials.password}</p>
                              </div>
                            </div>
                            <p className="text-xs text-cyan-400/80">
                              {t.validUntil} {new Date(ciResult.wifiCredentials.validUntil).toLocaleDateString()}
                            </p>
                          </div>
                        )}

                        <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/30 text-sm text-center space-y-1">
                          <p>{t.pleaseProceed}</p>
                          <p className="text-emerald-400">{t.enjoyStay}</p>
                        </div>

                        <button
                          onClick={handleFullReset}
                          className="w-full h-14 text-base rounded-xl bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 transition-colors"
                        >
                          {t.done}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* CI Error */}
                {ciStep === 'error' && (
                  <motion.div key="ci-error" {...scaleIn} transition={{ duration: 0.3 }}>
                    <div className="rounded-2xl bg-slate-800/70 border border-red-500/20 backdrop-blur-sm p-6 sm:p-8">
                      <div className="text-center space-y-6">
                        <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                          <AlertTriangle className="w-8 h-8 text-red-400" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold">Unable to Check In</h2>
                          <p className="text-slate-400 mt-2">{errorMsg}</p>
                        </div>

                        <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/30 text-sm">
                          <p className="font-medium">{t.visitFrontDesk}</p>
                        </div>

                        <button
                          onClick={handleFullReset}
                          className="w-full h-14 text-lg font-semibold rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                        >
                          <RefreshCw className="w-5 h-5" /> {t.tryAgain}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ───────────────────────────────────────
              CHECK-OUT FLOW
              ─────────────────────────────────────── */}
          {mode === 'checkout' && (
            <div className="w-full max-w-lg">
              <AnimatePresence mode="wait">

                {/* CO Step 1: Enter Code */}
                {coStep === 'enter_code' && (
                  <motion.div key="co-enter" {...slideIn} transition={{ duration: 0.3 }}>
                    <div className="rounded-2xl bg-slate-800/70 border border-slate-700/50 backdrop-blur-sm p-6 sm:p-8">
                      <div className="text-center space-y-5">
                        <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
                          <DoorOpen className="w-8 h-8 text-amber-400" />
                        </div>
                        <div>
                          <h2 className="text-2xl sm:text-3xl font-bold">{t.findBooking}</h2>
                          <p className="text-slate-400 mt-1">{t.enterCode}</p>
                        </div>

                        <div className="space-y-4">
                          <input
                            value={coCode}
                            onChange={e => setCoCode(e.target.value.toUpperCase())}
                            onKeyDown={e => e.key === 'Enter' && verifyCheckOutCode()}
                            placeholder={t.codePlaceholder}
                            className="w-full h-16 sm:h-18 text-2xl text-center font-mono tracking-widest rounded-xl bg-slate-900/60 border border-slate-600/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                            autoFocus
                          />

                          {errorMsg && (
                            <motion.div
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"
                            >
                              <XCircle className="w-4 h-4 shrink-0" />
                              <p>{errorMsg}</p>
                            </motion.div>
                          )}

                          <button
                            onClick={verifyCheckOutCode}
                            disabled={!coCode.trim() || coVerifying}
                            className="w-full h-14 sm:h-16 text-lg font-semibold rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {coVerifying ? (
                              <><Loader2 className="w-5 h-5 animate-spin" /> {t.verifying}</>
                            ) : (
                              <>{t.findBookingBtn} <ChevronRight className="w-5 h-5" /></>
                            )}
                          </button>
                        </div>

                        <p className="text-xs text-slate-500">{t.codeHint}</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* CO Step 2: Verify Folio */}
                {coStep === 'verify_folio' && coBooking && (
                  <motion.div key="co-folio" {...slideIn} transition={{ duration: 0.3 }}>
                    <div className="rounded-2xl bg-slate-800/70 border border-slate-700/50 backdrop-blur-sm p-6 sm:p-8">
                      <div className="space-y-6">
                        <div className="text-center">
                          <h2 className="text-2xl sm:text-3xl font-bold">{t.reviewSettle}</h2>
                          <p className="text-slate-400 mt-1 text-sm">Review your stay details below</p>
                        </div>

                        {/* Guest & Room */}
                        <div className="p-4 sm:p-5 bg-slate-900/50 rounded-xl border border-slate-700/30 space-y-3">
                          <h3 className="font-semibold text-lg sm:text-xl">
                            {coBooking.guest.firstName} {coBooking.guest.lastName}
                          </h3>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="flex items-center gap-2 text-slate-300">
                              <KeyRound className="w-4 h-4 text-slate-500" />
                              <span>{t.room} {coBooking.room.number}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                              <Building2 className="w-4 h-4 text-slate-500" />
                              <span>{coBooking.roomType.name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                              <Clock className="w-4 h-4 text-slate-500" />
                              <span>{coBooking.nights} {coBooking.nights === 1 ? t.night : t.nights}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                              <CalendarX className="w-4 h-4 text-slate-500" />
                              <span>{new Date(coBooking.checkOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            </div>
                          </div>
                        </div>

                        {/* Total Amount */}
                        <div className="p-4 sm:p-5 bg-gradient-to-br from-amber-500/5 to-orange-500/5 rounded-xl border border-amber-500/15">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-amber-400 uppercase tracking-wider font-medium">{t.totalAmount}</p>
                              <p className="text-3xl font-bold mt-1">
                                {formatCurrency(coBooking.totalAmount, coBooking.currency)}
                              </p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                              <Receipt className="w-6 h-6 text-amber-400" />
                            </div>
                          </div>
                        </div>

                        {/* Balance note */}
                        <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-700/30">
                          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                          <p className="text-sm text-slate-400">{t.settleNote}</p>
                        </div>

                        {/* Confirmation code */}
                        <div className="text-center">
                          <span className="inline-block px-4 py-1.5 rounded-lg bg-slate-700/50 border border-slate-600/50 font-mono text-sm tracking-wider">
                            {coBooking.confirmationCode}
                          </span>
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={() => { setCoStep('enter_code'); setErrorMsg(''); startTimeout(); }}
                            className="flex-1 h-14 text-base rounded-xl bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 transition-colors flex items-center justify-center gap-2"
                          >
                            <ChevronLeft className="w-5 h-5" /> {t.back}
                          </button>
                          <button
                            onClick={() => { setCoStep('confirm_checkout'); startTimeout(); }}
                            className="flex-1 h-14 text-base font-semibold rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                          >
                            {t.detailsCorrect} <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* CO Step 3: Confirm Check-Out */}
                {coStep === 'confirm_checkout' && coBooking && (
                  <motion.div key="co-confirm" {...slideIn} transition={{ duration: 0.3 }}>
                    <div className="rounded-2xl bg-slate-800/70 border border-slate-700/50 backdrop-blur-sm p-6 sm:p-8">
                      <div className="space-y-6">
                        <div className="text-center">
                          <h2 className="text-2xl sm:text-3xl font-bold">{t.confirmCheckOut}</h2>
                          <p className="text-slate-400 mt-1 text-sm">{t.confirmCheckoutDesc}</p>
                        </div>

                        {/* Summary */}
                        <div className="p-4 sm:p-5 bg-slate-900/50 rounded-xl border border-slate-700/30 space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">{t.guest}</span>
                            <span className="font-medium">{coBooking.guest.firstName} {coBooking.guest.lastName}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">{t.room}</span>
                            <span className="font-medium">{coBooking.room.number}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">{t.nightsStayed}</span>
                            <span className="font-medium">{coBooking.nights} {coBooking.nights === 1 ? t.night : t.nights}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">{t.totalAmount}</span>
                            <span className="font-medium text-amber-400">
                              {formatCurrency(coBooking.totalAmount, coBooking.currency)}
                            </span>
                          </div>
                        </div>

                        {/* Balance settlement note */}
                        <div className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-xl">
                          <div className="flex items-start gap-3">
                            <CreditCard className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium text-amber-400">{t.settleAtFrontDesk}</p>
                              <p className="text-sm text-slate-400 mt-1">{t.balanceNote}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={() => { setCoStep('verify_folio'); startTimeout(); }}
                            className="flex-1 h-14 text-base rounded-xl bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 transition-colors flex items-center justify-center gap-2"
                          >
                            <ChevronLeft className="w-5 h-5" /> {t.back}
                          </button>
                          <button
                            onClick={processCheckOut}
                            disabled={coChecking}
                            className="flex-1 h-14 text-base font-semibold rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                          >
                            {coChecking ? (
                              <><Loader2 className="w-5 h-5 animate-spin" /> {t.checkingOut}</>
                            ) : (
                              <>{t.checkOutNow} <LogOut className="w-5 h-5" /></>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* CO Step 4: Success */}
                {coStep === 'success' && coResult && (
                  <motion.div key="co-success" {...scaleIn} transition={{ duration: 0.4 }}>
                    <div className="rounded-2xl bg-slate-800/70 border border-amber-500/20 backdrop-blur-sm p-6 sm:p-8">
                      <div className="text-center space-y-6">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                          className="mx-auto w-20 h-20 rounded-full bg-amber-500/15 flex items-center justify-center border border-amber-500/30"
                        >
                          <CheckCircle2 className="w-10 h-10 text-amber-400" />
                        </motion.div>

                        <div>
                          <h2 className="text-3xl font-bold text-amber-400">{t.goodbyeGuest}</h2>
                          <p className="text-slate-300 mt-1 text-lg">{coResult.guestName}</p>
                        </div>

                        {/* Check-out info */}
                        <div className="p-5 sm:p-6 bg-gradient-to-br from-amber-500/5 to-orange-500/5 rounded-xl border border-amber-500/15 space-y-4">
                          <div>
                            <p className="text-xs text-amber-400 uppercase tracking-wider font-medium">{t.checkOutTime}</p>
                            <p className="text-3xl font-bold text-amber-400 mt-1">
                              {new Date(coResult.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-sm text-slate-400 mt-1">
                              {new Date(coResult.checkOutTime).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-slate-500">{t.room}</p>
                              <p className="font-medium">{coResult.roomNumber}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">{t.property}</p>
                              <p className="font-medium">{coResult.propertyName}</p>
                            </div>
                          </div>
                        </div>

                        {/* Balance info */}
                        {coResult.folioBalance > 0 && (
                          <div className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-xl">
                            <div className="flex items-start gap-3">
                              <CreditCard className="w-5 h-5 text-amber-400 shrink-0" />
                              <div className="text-left">
                                <p className="font-medium text-amber-400">{t.settleAtFrontDesk}</p>
                                <p className="text-xl font-bold mt-1">
                                  {formatCurrency(coResult.folioBalance, coResult.currency)}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {coResult.folioBalance <= 0 && (
                          <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-xl">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                              <p className="font-medium text-emerald-400">{t.allSettled}</p>
                            </div>
                          </div>
                        )}

                        <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/30 text-sm text-center space-y-1">
                          <p>{t.thankYou}</p>
                          <p className="text-amber-400">{t.haveSafeJourney}</p>
                        </div>

                        <button
                          onClick={handleFullReset}
                          className="w-full h-14 text-base rounded-xl bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 transition-colors"
                        >
                          {t.done}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* CO Error */}
                {coStep === 'error' && (
                  <motion.div key="co-error" {...scaleIn} transition={{ duration: 0.3 }}>
                    <div className="rounded-2xl bg-slate-800/70 border border-red-500/20 backdrop-blur-sm p-6 sm:p-8">
                      <div className="text-center space-y-6">
                        <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                          <AlertTriangle className="w-8 h-8 text-red-400" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold">Unable to Check Out</h2>
                          <p className="text-slate-400 mt-2">{errorMsg}</p>
                        </div>

                        <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/30 text-sm">
                          <p className="font-medium">{t.visitFrontDesk}</p>
                        </div>

                        <button
                          onClick={handleFullReset}
                          className="w-full h-14 text-lg font-semibold rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                        >
                          <RefreshCw className="w-5 h-5" /> {t.tryAgain}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* ═══════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════ */}
      <footer className="relative z-10 px-4 sm:px-6 py-4 text-center">
        <p className="text-xs text-slate-500">
          {t.poweredBy}
        </p>
      </footer>
    </div>
  );
}

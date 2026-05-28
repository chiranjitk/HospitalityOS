'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Search,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';

type KioskMode = 'checkin' | 'checkout';
type KioskStep = 'enter_code' | 'verify_details' | 'id_terms' | 'review_folio' | 'make_payment' | 'success' | 'error';

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

const STEP_CONFIG_CHECKIN = {
  enter_code: { step: 1, title: 'Find Your Booking' },
  verify_details: { step: 2, title: 'Verify Your Details' },
  id_terms: { step: 3, title: 'Confirm & Check In' },
  success: { step: 4, title: 'Welcome!' },
  error: { step: 0, title: 'Something Went Wrong' },
};

const STEP_CONFIG_CHECKOUT = {
  enter_code: { step: 1, title: 'Find Your Booking' },
  verify_details: { step: 2, title: 'Review Stay' },
  review_folio: { step: 3, title: 'Review Folio' },
  make_payment: { step: 4, title: 'Make Payment' },
  success: { step: 5, title: 'Thank You!' },
  error: { step: 0, title: 'Something Went Wrong' },
};

const TIMEOUT_SECONDS = 120;

export default function ExpressKiosk() {
  const { toast } = useToast();
  const t = useTranslations('frontdesk');
  const [mode, setMode] = useState<KioskMode>('checkin');
  const [step, setStep] = useState<KioskStep>('enter_code');
  const [folioData, setFolioData] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi' | 'qr_code'>('card');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [bookingData, setBookingData] = useState<KioskBookingData | null>(null);
  const [checkInResult, setCheckInResult] = useState<CheckInResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [idVerified, setIdVerified] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [timeLeft, setTimeLeft] = useState(TIMEOUT_SECONDS);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-timeout management
  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setTimeLeft(TIMEOUT_SECONDS);

    countdownRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleReset();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    timeoutRef.current = setTimeout(() => {
      handleReset();
    }, TIMEOUT_SECONDS * 1000);
  }, []);

  useEffect(() => {
    resetTimeout();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [resetTimeout]);

  // Reset kiosk
  const handleReset = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setStep('enter_code');
    setConfirmationCode('');
    setBookingData(null);
    setCheckInResult(null);
    setIdVerified(false);
    setTermsAccepted(false);
    setErrorMsg('');
    setTimeLeft(TIMEOUT_SECONDS);
    resetTimeout();
  };

  // Verify booking code
  const verifyCode = async () => {
    if (!confirmationCode.trim()) return;

    setIsVerifying(true);
    setErrorMsg('');

    try {
      const response = await fetch(`/api/frontdesk/kiosk-session?code=${encodeURIComponent(confirmationCode.trim())}`);
      if (!response.ok) { const text = await response.text().catch(() => 'Unknown error'); throw new Error(text); }
      const result = await response.json();

      if (result.success) {
        setBookingData(result.data);
        setStep('verify_details');
        resetTimeout();
      } else {
        const code = result.error?.code;
        if (code === 'TOO_EARLY') {
          setErrorMsg('Check-in is not yet available for this booking. Please visit the front desk.');
        } else if (code === 'EXPIRED') {
          setErrorMsg('This booking has expired. Please visit the front desk for assistance.');
        } else if (code === 'NO_ROOM') {
          setErrorMsg('Your room has not been assigned yet. Please visit the front desk.');
        } else {
          setErrorMsg('No confirmed booking found with this code. Please try again.');
        }
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setErrorMsg('Unable to verify your booking. Please try again or visit the front desk.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Process check-in
  const processCheckIn = async () => {
    if (!bookingData || !idVerified || !termsAccepted) return;

    setIsCheckingIn(true);
    try {
      const response = await fetch('/api/frontdesk/kiosk-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: bookingData.bookingId,
          idVerified: true,
          termsAccepted: true,
        }),
      });

      if (!response.ok) { const text = await response.text().catch(() => 'Unknown error'); throw new Error(text); }
      const result = await response.json();

      if (result.success) {
        setCheckInResult(result.data);
        setStep('success');
        // H-16 FIX: Show warning if WiFi provisioning failed
        if (result.data.wifiWarning) {
          toast({ title: 'WiFi Notice', description: result.data.wifiWarning, variant: 'destructive' });
        }
      } else {
        setErrorMsg(result.error?.message || 'Check-in failed. Please visit the front desk.');
        setStep('error');
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setErrorMsg('Unable to complete check-in. Please visit the front desk.');
      setStep('error');
    } finally {
      setIsCheckingIn(false);
    }
  };

  // H-12 FIX: Fetch folio data for checkout review
  const fetchFolio = async () => {
    if (!bookingData) return;
    try {
      const res = await fetch(`/api/folios?bookingId=${bookingData.bookingId}`);
      const result = await res.json();
      if (result.success && result.data?.length > 0) {
        setFolioData(result.data[0]);
      }
    } catch { /* ignore */ }
  };

  // H-12 FIX: Process kiosk payment
  const processPayment = async () => {
    if (!bookingData || !folioData) return;
    setIsCheckingOut(true);
    try {
      const balance = folioData.balance || 0;
      if (balance <= 0) {
        // No balance to pay, proceed directly to checkout
        await processCheckout();
        return;
      }
      const res = await fetch('/api/frontdesk/kiosk-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: bookingData.bookingId,
          amount: balance,
          method: paymentMethod,
          currency: bookingData.currency,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Payment Successful' });
        await processCheckout();
      } else {
        setErrorMsg(result.error?.message || 'Payment failed');
        setStep('error');
      }
    } catch {
      setErrorMsg('Payment processing error');
      setStep('error');
    } finally {
      setIsCheckingOut(false);
    }
  };

  // H-12 FIX: Process express check-out
  const processCheckout = async () => {
    if (!bookingData) return;
    setIsCheckingOut(true);
    try {
      const res = await fetch('/api/frontdesk/kiosk-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: bookingData.bookingId }),
      });
      const result = await res.json();
      if (result.success) {
        setStep('success');
      } else {
        setErrorMsg(result.error?.message || 'Checkout failed');
        setStep('error');
      }
    } catch {
      setErrorMsg('Unable to process checkout');
      setStep('error');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const stepConfig = mode === 'checkin' ? STEP_CONFIG_CHECKIN : STEP_CONFIG_CHECKOUT;
  const currentStepConfig = stepConfig[step] || stepConfig.enter_code;
  const totalSteps = mode === 'checkin' ? 4 : 5;
  const progressPercent = step === 'error' ? 0 : step === 'success' ? 100 : (currentStepConfig.step / totalSteps) * 100;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950/30 dark:to-indigo-950/30 flex flex-col">
      {/* Progress Bar */}
      {step !== 'error' && (
        <div className="w-full h-2 bg-muted">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}

      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-semibold">Express Kiosk</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* H-12 FIX: Mode toggle for check-in/check-out */}
          <div className="flex bg-muted rounded-lg p-0.5">
            <button
              onClick={() => { setMode('checkin'); handleReset(); }}
              className={cn('px-4 py-1.5 text-sm rounded-md transition-all', mode === 'checkin' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground')}
            >
              Check-In
            </button>
            <button
              onClick={() => { setMode('checkout'); handleReset(); }}
              className={cn('px-4 py-1.5 text-sm rounded-md transition-all', mode === 'checkout' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground')}
            >
              Check-Out
            </button>
          </div>

          {/* Auto-timeout indicator */}
          {step !== 'success' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Hourglass className={cn("h-4 w-4", timeLeft < 30 && "text-amber-500 animate-pulse")} />
              <span className="font-mono">{formatTime(timeLeft)}</span>
            </div>
          )}

          {step !== 'enter_code' && step !== 'success' && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Start Over
            </Button>
          )}
        </div>
      </div>

      {/* Step Indicator */}
      {step !== 'error' && step !== 'success' && (
        <div className="flex items-center justify-center gap-2 pb-6">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                s <= currentStepConfig.step
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}>
                {s < currentStepConfig.step ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  s
                )}
              </div>
              {s < totalSteps && <div className={cn("w-12 h-0.5", s < currentStepConfig.step ? "bg-primary" : "bg-muted")} />}
            </div>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-6 pb-6">
        <AnimatePresence mode="wait">
          {/* Step 1: Enter Confirmation Code */}
          {step === 'enter_code' && (
            <motion.div
              key="enter_code"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full max-w-lg"
            >
              <Card className="p-8 border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <div className="text-center space-y-6">
                  <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Search className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Find Your Booking</h2>
                    <p className="text-muted-foreground mt-2">Enter your confirmation code to start check-in</p>
                  </div>

                  <div className="space-y-4">
                    <div className="relative">
                      <Input
                        value={confirmationCode}
                        onChange={(e) => setConfirmationCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && verifyCode()}
                        placeholder="e.g. STY-AB12CD"
                        className="h-16 text-2xl text-center font-mono tracking-widest"
                        autoFocus
                      />
                    </div>

                    {errorMsg && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm"
                      >
                        <XCircle className="h-4 w-4 shrink-0" />
                        <p>{errorMsg}</p>
                      </motion.div>
                    )}

                    <Button
                      className="w-full h-14 text-lg"
                      onClick={verifyCode}
                      disabled={!confirmationCode.trim() || isVerifying}
                    >
                      {isVerifying ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          Find Booking
                          <ChevronRight className="h-5 w-5 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Your confirmation code can be found in your booking confirmation email
                  </p>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Step 2: Verify Details */}
          {step === 'verify_details' && bookingData && (
            <motion.div
              key="verify_details"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full max-w-lg"
            >
              <Card className="p-8 border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold">Verify Your Details</h2>
                    <p className="text-muted-foreground mt-1">Please confirm the information below is correct</p>
                  </div>

                  {/* Guest Info */}
                  <div className="p-4 bg-muted/50 rounded-xl space-y-3">
                    <h3 className="font-semibold text-lg">{bookingData.guest.firstName} {bookingData.guest.lastName}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{bookingData.roomType.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-muted-foreground" />
                        <span>Room {bookingData.room.number}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{bookingData.nights} night{bookingData.nights !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{bookingData.adults} adult{bookingData.adults > 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs">{bookingData.property.name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">Check-in</p>
                      <p className="font-semibold">{new Date(bookingData.checkIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                      <p className="text-xs text-muted-foreground">from {bookingData.property.checkInTime}</p>
                    </div>
                    <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">Check-out</p>
                      <p className="font-semibold">{new Date(bookingData.checkOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                      <p className="text-xs text-muted-foreground">by {bookingData.property.checkOutTime}</p>
                    </div>
                  </div>

                  {/* Confirmation Code */}
                  <div className="text-center">
                    <Badge variant="outline" className="font-mono text-sm px-4 py-1">
                      {bookingData.confirmationCode}
                    </Badge>
                  </div>

                  {bookingData.specialRequests && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Special Requests</p>
                      <p className="text-sm mt-1">{bookingData.specialRequests}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 h-14 text-lg" onClick={() => setStep('enter_code')}>
                      <ChevronLeft className="h-5 w-5 mr-1" />
                      Back
                    </Button>
                    <Button
                      className="flex-1 h-14 text-lg"
                      onClick={async () => {
                        if (mode === 'checkout') {
                          await fetchFolio();
                          setStep('review_folio');
                        } else {
                          setStep('id_terms');
                        }
                      }}
                    >
                      {mode === 'checkout' ? 'Review Folio' : 'Details Correct'}
                      <ChevronRight className="h-5 w-5 ml-1" />
                    </Button>
                  </div>

                  <p className="text-xs text-center text-muted-foreground">
                    If any details are incorrect, please visit the front desk
                  </p>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Step 3: ID Verification & Terms */}
          {step === 'id_terms' && bookingData && (
            <motion.div
              key="id_terms"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full max-w-lg"
            >
              <Card className="p-8 border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold">Confirm & Check In</h2>
                    <p className="text-muted-foreground mt-1">Complete the final steps to check in</p>
                  </div>

                  {/* ID Verification */}
                  <div className={cn(
                    "p-4 rounded-xl border-2 transition-colors",
                    idVerified
                      ? "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/30"
                      : "border-muted"
                  )}>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="idVerify"
                        checked={idVerified}
                        onCheckedChange={(checked) => {
                          setIdVerified(checked === true);
                          resetTimeout();
                        }}
                        className="mt-1"
                      />
                      <Label htmlFor="idVerify" className="text-base cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Shield className="h-5 w-5 text-primary" />
                          <span className="font-medium">I confirm my identity</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          I verify that I am the guest named on this booking and have a valid ID document with me
                        </p>
                      </Label>
                    </div>
                  </div>

                  {/* Terms & Conditions */}
                  <div className={cn(
                    "p-4 rounded-xl border-2 transition-colors",
                    termsAccepted
                      ? "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/30"
                      : "border-muted"
                  )}>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="termsAccept"
                        checked={termsAccepted}
                        onCheckedChange={(checked) => {
                          setTermsAccepted(checked === true);
                          resetTimeout();
                        }}
                        className="mt-1"
                      />
                      <Label htmlFor="termsAccept" className="text-base cursor-pointer">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">I accept the terms & conditions</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2 space-y-1">
                          I agree to the hotel&apos;s policies including check-in/out times, house rules, payment terms, and liability policies. I understand that any damages to hotel property may incur additional charges.
                        </p>
                      </Label>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Guest</span>
                      <span className="font-medium">{bookingData.guest.firstName} {bookingData.guest.lastName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Room</span>
                      <span className="font-medium">{bookingData.room.number} ({bookingData.roomType.name})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-medium">{bookingData.nights} night{bookingData.nights !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 h-14 text-lg" onClick={() => setStep('verify_details')}>
                      <ChevronLeft className="h-5 w-5 mr-1" />
                      Back
                    </Button>
                    <Button
                      className="flex-1 h-14 text-lg"
                      onClick={processCheckIn}
                      disabled={!idVerified || !termsAccepted || isCheckingIn}
                    >
                      {isCheckingIn ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Checking In...
                        </>
                      ) : (
                        <>
                          Check In Now
                          <CheckCircle2 className="h-5 w-5 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* H-12 FIX: Step 3 (Checkout): Review Folio */}
          {step === 'review_folio' && bookingData && (
            <motion.div
              key="review_folio"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full max-w-lg"
            >
              <Card className="p-8 border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold">Review Your Folio</h2>
                    <p className="text-muted-foreground mt-1">Review charges before check-out</p>
                  </div>

                  {folioData ? (
                    <div className="space-y-3">
                      <div className="p-4 bg-muted/50 rounded-xl space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Room Charges</span>
                          <span className="font-medium">${folioData.subtotal?.toFixed(2) || '0.00'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Taxes</span>
                          <span className="font-medium">${folioData.taxes?.toFixed(2) || '0.00'}</span>
                        </div>
                        {folioData.serviceCharge > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Service Charge</span>
                            <span className="font-medium">${folioData.serviceCharge.toFixed(2)}</span>
                          </div>
                        )}
                        {folioData.discount > 0 && (
                          <div className="flex justify-between text-sm text-green-600">
                            <span>Discount</span>
                            <span>-${folioData.discount.toFixed(2)}</span>
                          </div>
                        )}
                        <Separator />
                        <div className="flex justify-between text-lg font-bold">
                          <span>Balance Due</span>
                          <span className={folioData.balance > 0 ? 'text-red-600' : 'text-green-600'}>
                            ${folioData.balance?.toFixed(2) || '0.00'}
                          </span>
                        </div>
                        {folioData.paidAmount > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Already Paid</span>
                            <span className="font-medium text-green-600">${folioData.paidAmount.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                      <span className="text-muted-foreground">Loading folio...</span>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 h-14 text-lg" onClick={() => setStep('verify_details')}>
                      <ChevronLeft className="h-5 w-5 mr-1" />
                      Back
                    </Button>
                    <Button
                      className="flex-1 h-14 text-lg"
                      onClick={() => {
                        fetchFolio();
                        setStep('make_payment');
                      }}
                      disabled={!folioData}
                    >
                      {folioData?.balance > 0 ? 'Proceed to Payment' : 'Complete Check-Out'}
                      <ChevronRight className="h-5 w-5 ml-1" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* H-12 FIX: Step 4 (Checkout): Make Payment */}
          {step === 'make_payment' && bookingData && folioData && (
            <motion.div
              key="make_payment"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full max-w-lg"
            >
              <Card className="p-8 border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold">Settle Balance</h2>
                    <p className="text-muted-foreground mt-1">
                      {folioData.balance > 0 ? `Amount due: $${folioData.balance.toFixed(2)}` : 'No outstanding balance'}
                    </p>
                  </div>

                  {folioData.balance > 0 && (
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Payment Method</Label>
                      <div className="grid grid-cols-2 gap-3">
                        {([
                          { value: 'card', label: 'Credit/Debit Card', icon: '💳' },
                          { value: 'cash', label: 'Cash', icon: '💵' },
                          { value: 'upi', label: 'UPI', icon: '📱' },
                          { value: 'qr_code', label: 'QR Code', icon: '📷' },
                        ] as const).map((method) => (
                          <button
                            key={method.value}
                            onClick={() => setPaymentMethod(method.value)}
                            className={cn(
                              'p-4 rounded-xl border-2 text-left transition-all',
                              paymentMethod === method.value
                                ? 'border-primary bg-primary/5'
                                : 'border-muted hover:border-primary/50'
                            )}
                          >
                            <span className="text-2xl">{method.icon}</span>
                            <p className="text-sm font-medium mt-1">{method.label}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {folioData.balance <= 0 && (
                    <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-xl text-center">
                      <p className="text-green-700 dark:text-green-300 font-medium">All charges are settled!</p>
                      <p className="text-sm text-green-600 dark:text-green-400">You can proceed to check out.</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 h-14 text-lg" onClick={() => setStep('review_folio')}>
                      <ChevronLeft className="h-5 w-5 mr-1" />
                      Back
                    </Button>
                    <Button
                      className="flex-1 h-14 text-lg"
                      onClick={processPayment}
                      disabled={isCheckingOut}
                    >
                      {isCheckingOut ? (
                        <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Processing...</>
                      ) : folioData.balance > 0 ? (
                        <><CreditCard className="h-5 w-5 mr-2" /> Pay & Check Out</>
                      ) : (
                        <><CheckCircle2 className="h-5 w-5 mr-2" /> Check Out</>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Step 4 (Check-In) / Step 5 (Check-Out): Success */}
          {step === 'success' && (checkInResult || mode === 'checkout') && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-lg"
            >
              <Card className="p-8 border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <div className="text-center space-y-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    className="mx-auto w-20 h-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center"
                  >
                    <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                  </motion.div>

                  <div>
                    <h2 className="text-2xl font-bold text-green-600 dark:text-green-400">Welcome!</h2>
                    <p className="text-muted-foreground mt-1">{checkInResult.guestName}</p>
                  </div>

                  {/* Room Info */}
                  <div className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Your Room</p>
                      <p className="text-4xl font-bold text-primary">{checkInResult.roomNumber}</p>
                      <p className="text-sm text-muted-foreground">{checkInResult.roomType} · Floor {checkInResult.roomFloor}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Check-in Time</p>
                        <p className="font-medium">{new Date(checkInResult.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Property</p>
                        <p className="font-medium">{checkInResult.propertyName}</p>
                      </div>
                    </div>
                  </div>

                  {/* WiFi Credentials */}
                  {checkInResult.wifiCredentials && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-left space-y-3">
                      <div className="flex items-center gap-2">
                        <Wifi className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <h3 className="font-semibold">WiFi Credentials</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Username</p>
                          <p className="font-mono font-medium text-sm">{checkInResult.wifiCredentials.username}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Password</p>
                          <p className="font-mono font-medium text-sm">{checkInResult.wifiCredentials.password}</p>
                        </div>
                      </div>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        Valid until {new Date(checkInResult.wifiCredentials.validUntil).toLocaleDateString()}
                      </p>
                    </div>
                  )}

                  <div className="p-3 bg-muted rounded-lg text-sm text-center space-y-1">
                    <p>Please proceed to your room. Your key card will be provided at the front desk.</p>
                    <p className="text-muted-foreground">Enjoy your stay!</p>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full h-12"
                    onClick={handleReset}
                  >
                    Done
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Error */}
          {step === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              className="w-full max-w-lg"
            >
              <Card className="p-8 border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <div className="text-center space-y-6">
                  <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                    <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Unable to Check In</h2>
                    <p className="text-muted-foreground mt-2">{errorMsg}</p>
                  </div>

                  <div className="p-4 bg-muted rounded-lg text-sm">
                    <p className="font-medium">Please visit the front desk for assistance.</p>
                    <p className="text-muted-foreground mt-1">Our staff will be happy to help you complete your check-in.</p>
                  </div>

                  <Button className="w-full h-14 text-lg" onClick={handleReset}>
                    <RefreshCw className="h-5 w-5 mr-2" />
                    Try Again
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 text-center">
        <p className="text-xs text-muted-foreground">
          Powered by StaySuite-HospitalityOS
        </p>
      </div>
    </div>
  );
}
